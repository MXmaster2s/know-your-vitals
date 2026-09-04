/**
 * The MCP server behind /mcp/<token> — streamable HTTP, JSON-RPC 2.0 — so
 * ChatGPT and Claude can read one household's data.
 *
 * The token in the path is the whole credential. It is hashed here and handed
 * to mcp_call() in Postgres, a function only the service role may execute,
 * which resolves the owner and answers with data scoped to their household.
 * Stateless on purpose: no session id, no SSE stream; every request is one
 * POST and one JSON reply. That is the subset both clients actually use, and
 * it means nothing here holds health data between requests.
 *
 * Runs as a Cloudflare Pages Function beside the static site. Two secrets,
 * set with `wrangler pages secret put`: SUPABASE_URL and SUPABASE_SERVICE_KEY.
 * The service key never leaves this function.
 */

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
}

interface RpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

type RpcResponse = { jsonrpc: "2.0"; id: string | number | null } & (
  | { result: unknown }
  | { error: { code: number; message: string } }
);

/** Newest first. A client asking for an older revision gets that one back. */
const PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];

const SERVER = { name: "health", version: "1.0.0" };

const INSTRUCTIONS =
  "Read-only access to one household's lab results and nutrition plan. Call " +
  "overview first. Report what the numbers did: the value, the direction " +
  "since the previous reading, and where it sits against the range the lab " +
  "printed. Do not diagnose or prescribe; when something is outside its " +
  "range, suggest the question to put to a doctor.";

const TOOLS = [
  {
    name: "overview",
    description:
      "Everyone in the household with the latest reading of every marker — " +
      "value, unit, the lab's printed range, flag, previous reading — plus " +
      "qualitative findings and active nutrition targets. Start here.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "marker",
    description:
      "The full history of one marker for the household: every reading with " +
      "its date, lab, and the range that lab printed. Partial names match — " +
      "'ldl', 'vitamin d', 'hba1c'. Lists what is available when nothing matches.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Marker name or id; partial match" },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "nutrition",
    description:
      "Each person's planned standard day: meals with time, the foods in them " +
      "and their ingredients with grams, per-item and per-meal kcal, protein, " +
      "carbohydrate, fat, fibre and cost in rupees, plus nutrition and " +
      "activity targets. A plan, not a log.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "reports",
    description:
      "Every lab visit — date, lab, how many readings, whether it is still " +
      "planned — the qualitative findings, and the status of PDFs the account " +
      "has uploaded.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
];

export const onRequest = async (ctx: {
  request: Request;
  env: Env;
  params: Record<string, string | string[] | undefined>;
}): Promise<Response> => {
  const { request, env } = ctx;
  const raw = ctx.params.token;
  const token = (Array.isArray(raw) ? raw.join("/") : (raw ?? "")).trim();

  if (request.method !== "POST") {
    return json({ error: "This is an MCP server. POST JSON-RPC here." }, 405, {
      Allow: "POST",
    });
  }
  if (!token) {
    return json({ error: "No token in the address. Create one on the Connect your AI page." }, 401);
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
    return json({ error: "server not configured" }, 500);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(rpcError(null, -32700, "Parse error"), 400);
  }

  const hash = await sha256(token);
  const messages = Array.isArray(body) ? body : [body];
  const replies: RpcResponse[] = [];
  for (const msg of messages) {
    const reply = await handle(msg as RpcRequest, hash, env);
    if (reply === "unauthorized") return json({ error: "invalid token" }, 401);
    if (reply) replies.push(reply);
  }
  // Only notifications — nothing to say back.
  if (replies.length === 0) return new Response(null, { status: 202 });
  return json(Array.isArray(body) ? replies : replies[0], 200);
};

async function handle(
  msg: RpcRequest,
  hash: string,
  env: Env
): Promise<RpcResponse | "unauthorized" | null> {
  if (!msg || typeof msg !== "object" || typeof msg.method !== "string") {
    return rpcError(null, -32600, "Invalid request");
  }
  const id = msg.id ?? null;
  const notification = msg.id === undefined;
  try {
    switch (msg.method) {
      case "initialize": {
        // Check the token now, so a wrong address fails when it is added
        // rather than at the first question.
        const ping = await call(env, hash, "ping", {});
        if (ping?.error === "invalid token") return "unauthorized";
        if (ping?.error) return rpcError(id, -32000, String(ping.error));
        const asked = String(msg.params?.protocolVersion ?? "");
        return ok(id, {
          protocolVersion: PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER,
          instructions: INSTRUCTIONS,
        });
      }
      case "ping":
        return ok(id, {});
      case "tools/list":
        return ok(id, { tools: TOOLS });
      case "resources/list":
        return ok(id, { resources: [] });
      case "prompts/list":
        return ok(id, { prompts: [] });
      case "tools/call": {
        const name = String(msg.params?.name ?? "");
        if (!TOOLS.some((t) => t.name === name)) {
          return rpcError(id, -32602, `Unknown tool: ${name}`);
        }
        const args = (msg.params?.arguments ?? {}) as Record<string, unknown>;
        const data = await call(env, hash, name, args);
        if (data?.error === "invalid token") return "unauthorized";
        if (data?.error) {
          return ok(id, { content: [{ type: "text", text: String(data.error) }], isError: true });
        }
        return ok(id, { content: [{ type: "text", text: JSON.stringify(data) }] });
      }
      default:
        if (notification) return null; // notifications/initialized and friends
        return rpcError(id, -32601, `Method not found: ${msg.method}`);
    }
  } catch (e) {
    if (notification) return null;
    return rpcError(id, -32000, e instanceof Error ? e.message : "server error");
  }
}

/** One round trip to Postgres. The service key stays in this function. */
async function call(
  env: Env,
  hash: string,
  tool: string,
  args: unknown
): Promise<Record<string, unknown> | null> {
  const r = await fetch(`${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/rpc/mcp_call`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      "User-Agent": "health-mcp/1.0",
    },
    body: JSON.stringify({ p_hash: hash, p_tool: tool, p_args: args ?? {} }),
  });
  if (!r.ok) throw new Error(`database answered ${r.status}`);
  return (await r.json()) as Record<string, unknown> | null;
}

function ok(id: string | number | null, result: unknown): RpcResponse {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(id: string | number | null, code: number, message: string): RpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
