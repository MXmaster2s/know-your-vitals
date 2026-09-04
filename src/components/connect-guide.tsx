"use client";

import * as React from "react";
import Link from "next/link";
import posthog from "posthog-js";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ago, shortDate } from "@/lib/analytics";
import {
  createMcpToken,
  getMcpTokens,
  revokeMcpToken,
  type McpToken,
} from "@/lib/data";

/**
 * Setup documentation for the MCP server, plus the one control it needs: the
 * addresses this account has minted. Behind sign-in, because an address is a
 * key to the account's own data.
 *
 * Written as instructions, not conversation. Every step names the label the
 * reader will see, in the order they will see it, because the people
 * following this are not technical and stop the moment a word on the page
 * does not match a word on their screen.
 */
export function Guide({ addresses }: { addresses: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-14">
      <section className="space-y-3">
        <h1 className="font-serif text-3xl leading-tight sm:text-4xl">
          Connect your AI
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          ChatGPT and Claude can read this account&apos;s data through an MCP
          server. Setup is one address pasted once into the app&apos;s
          settings. After that, questions are asked in the chat as usual.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-2xl leading-tight">Your addresses</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          An address is a key. Anyone who has it can read this account&apos;s
          data, so treat it like a password. Create one per app, and revoke it
          here if it is ever shared by mistake.
        </p>
        {addresses}
      </section>

      <section className="space-y-5">
        <h2 className="font-serif text-2xl leading-tight">Set up ChatGPT</h2>
        <Requirements>
          The ChatGPT desktop app for Mac or Windows. MCP servers are set up in
          the desktop app&apos;s settings.
        </Requirements>
        <Steps>
          <Step n={1}>Create an address above and copy it.</Step>
          <Step n={2}>
            Open the ChatGPT desktop app and open <Ui>Settings</Ui>.
          </Step>
          <Step n={3}>
            Select <Ui>MCP servers</Ui>, then <Ui>Add server</Ui>.
          </Step>
          <Step n={4}>
            Fill in the form:
            <Fields
              rows={[
                ["Name", "Health"],
                ["Transport", "Streamable HTTP"],
                ["URL", "the address you copied"],
              ]}
            />
          </Step>
          <Step n={5}>
            Select <Ui>Save</Ui>, then quit and reopen ChatGPT.
          </Step>
          <Step n={6}>
            In a new chat, type <Code>/mcp</Code>. <Ui>Health</Ui> is listed
            among the connected servers.
          </Step>
        </Steps>
        <Note>
          If <Ui>Settings</Ui> has no <Ui>MCP servers</Ui> entry, update the
          app to its current version and look again.
        </Note>
      </section>

      <section className="space-y-5">
        <h2 className="font-serif text-2xl leading-tight">Set up Claude</h2>
        <Requirements>
          A Claude account, on any plan. The Free plan allows one custom
          connector; Pro, Max, Team and Enterprise allow more.
        </Requirements>
        <Steps>
          <Step n={1}>Create an address above and copy it.</Step>
          <Step n={2}>
            Open <Code>claude.ai</Code> in a browser, or the Claude desktop
            app, and sign in.
          </Step>
          <Step n={3}>
            In the sidebar, select <Ui>Customize</Ui>, then{" "}
            <Ui>Connectors</Ui>.
          </Step>
          <Step n={4}>
            Select <Ui>+</Ui>, then <Ui>Add custom connector</Ui>.
          </Step>
          <Step n={5}>
            Fill in the form and leave <Ui>Advanced settings</Ui> empty:
            <Fields
              rows={[
                ["Name", "Health"],
                ["Remote MCP server URL", "the address you copied"],
              ]}
            />
          </Step>
          <Step n={6}>
            Select <Ui>Add</Ui>.
          </Step>
          <Step n={7}>
            In a chat, select the <Ui>+</Ui> at the lower left, then{" "}
            <Ui>Connectors</Ui>, and turn on <Ui>Health</Ui>.
          </Step>
        </Steps>
        <Note>
          On a Team or Enterprise plan an owner adds the connector under{" "}
          <Ui>Organization settings</Ui> → <Ui>Connectors</Ui>; members then
          find it under <Ui>Customize</Ui> → <Ui>Connectors</Ui> and select{" "}
          <Ui>Connect</Ui>. Older versions of the app show{" "}
          <Ui>Settings</Ui> → <Ui>Connectors</Ui> instead of{" "}
          <Ui>Customize</Ui>.
        </Note>
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-2xl leading-tight">Ask</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Once connected, the AI reads what it needs for each question. Some
          that work well:
        </p>
        <ul className="space-y-2 text-sm leading-relaxed">
          <Prompt>What changed most since my last blood test?</Prompt>
          <Prompt>
            Show my LDL history against the range each lab printed.
          </Prompt>
          <Prompt>
            Does my planned day meet my protein target, and where is the cost
            going?
          </Prompt>
          <Prompt>
            Draft a note for my doctor covering my last three visits.
          </Prompt>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-2xl leading-tight">
          What the AI can read
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-3 text-sm leading-relaxed">
          <Tool name="overview">
            Everyone in this household, with the latest reading of every
            marker, the lab&apos;s printed range, the previous reading,
            findings, and active nutrition targets.
          </Tool>
          <Tool name="marker">The full history of one marker.</Tool>
          <Tool name="nutrition">
            The planned day: meals, ingredients, grams, calories, protein,
            carbohydrate, fat, fibre, cost, and targets.
          </Tool>
          <Tool name="reports">
            Every lab visit, the findings, and the status of uploaded PDFs.
          </Tool>
        </dl>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Read-only, and only this household — never the demo household or
          anyone else&apos;s. The AI cannot add, change or delete anything.
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Every connected AI is handed a standing brief when it connects: ten
          numbered rules covering how to read a lab range, what the data does
          not contain, and the instruction to report what the numbers did
          rather than diagnose. Read it at{" "}
          <a
            href="/mcp-guidelines.md"
            className="underline decoration-border underline-offset-4 hover:decoration-foreground"
          >
            /mcp-guidelines.md
          </a>
          .
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-2xl leading-tight">Remove access</h2>
        <Steps>
          <Step n={1}>
            Select <Ui>Revoke</Ui> beside the address above. Every app using
            that address stops reading immediately.
          </Step>
          <Step n={2}>
            Remove the entry from the app: in ChatGPT under <Ui>Settings</Ui>{" "}
            → <Ui>MCP servers</Ui>; in Claude under <Ui>Customize</Ui> →{" "}
            <Ui>Connectors</Ui>, using the connector&apos;s <Ui>⋯</Ui> menu.
          </Step>
        </Steps>
      </section>

      <section className="space-y-3 border-t pt-8">
        <h2 className="font-serif text-lg">Without a connector</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Every card on{" "}
          <Link
            href="/"
            className="underline decoration-border underline-offset-4 hover:decoration-foreground"
          >
            the dashboard
          </Link>{" "}
          has a copy button in its top right corner. It copies that
          marker&apos;s full history as plain text, ready to paste into any AI
          together with a question.
        </p>
      </section>
    </div>
  );
}

// ------------------------------------------------------------ addresses ----

/** The stateful half: loads, mints, revokes. The view is separate so it can
 *  be rendered with fixtures. */
export function Addresses() {
  const [tokens, setTokens] = React.useState<McpToken[] | null>(null);
  const [fresh, setFresh] = React.useState<{ token: string; label: string } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [origin, setOrigin] = React.useState("");

  React.useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const load = React.useCallback(async () => {
    try {
      setTokens(await getMcpTokens());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load addresses");
    }
  }, []);
  React.useEffect(() => {
    void load();
  }, [load]);

  async function create(label: string) {
    setBusy(true);
    setError(null);
    try {
      const token = await createMcpToken(label);
      setFresh({ token, label });
      posthog.capture("mcp_address_created", { label });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the address");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(t: McpToken) {
    if (!window.confirm(`Revoke "${t.label}"? Any app using it stops reading immediately.`)) return;
    setBusy(true);
    setError(null);
    try {
      await revokeMcpToken(t.id);
      posthog.capture("mcp_address_revoked");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not revoke the address");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AddressesView
      tokens={tokens}
      fresh={fresh}
      origin={origin}
      busy={busy}
      error={error}
      onCreate={create}
      onRevoke={revoke}
    />
  );
}

export function AddressesView({
  tokens,
  fresh,
  origin,
  busy,
  error,
  onCreate,
  onRevoke,
}: {
  tokens: McpToken[] | null;
  fresh: { token: string; label: string } | null;
  origin: string;
  busy: boolean;
  error: string | null;
  onCreate: (label: string) => void;
  onRevoke: (t: McpToken) => void;
}) {
  const [label, setLabel] = React.useState("ChatGPT");
  return (
    <div className="space-y-4">
      {fresh && (
        <div className="space-y-2 rounded-xl border border-positive/50 bg-positive/5 p-4">
          <p className="text-sm font-medium">
            Copy this address now. It is shown once.
          </p>
          <CopyRow value={`${origin}/mcp/${fresh.token}`} />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Labelled &ldquo;{fresh.label}&rdquo;. If it is lost, revoke it
            below and create another.
          </p>
        </div>
      )}

      {tokens === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : tokens.length === 0 ? (
        <p className="text-sm text-muted-foreground">No addresses yet.</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {tokens.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{t.label}</p>
                <p className="text-xs text-muted-foreground">
                  Created {shortDate(t.created_at)} ·{" "}
                  {t.last_used_at ? `last used ${ago(t.last_used_at)}` : "not used yet"}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => onRevoke(t)}
              >
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-center"
        onSubmit={(e) => {
          e.preventDefault();
          onCreate(label.trim() || "AI");
        }}
      >
        <label className="flex flex-1 items-center gap-3 text-sm">
          <span className="shrink-0 text-muted-foreground">Label</span>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={40}
            aria-label="Label for the new address"
            placeholder="ChatGPT, Claude…"
          />
        </label>
        <Button type="submit" disabled={busy}>
          Create address
        </Button>
      </form>

      {error && <p className="text-sm text-attention">{error}</p>}
    </div>
  );
}

// -------------------------------------------------------------- pieces ----

function Requirements({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm leading-relaxed text-muted-foreground">
      <span className="font-medium text-foreground">Requirements. </span>
      {children}
    </p>
  );
}

function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="space-y-3">{children}</ol>;
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-4 text-sm leading-relaxed">
      <span className="mt-0.5 shrink-0 font-mono text-xs tabular-nums text-muted-foreground/70">
        {n}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  );
}

/** A label exactly as it appears on the reader's screen. */
function Ui({ children }: { children: React.ReactNode }) {
  return (
    <strong className="font-medium text-foreground">{children}</strong>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[13px]">
      {children}
    </code>
  );
}

function Fields({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg border bg-card/40 px-3 py-2 text-sm">
      {rows.map(([k, v]) => (
        <React.Fragment key={k}>
          <dt className="text-muted-foreground">{k}</dt>
          <dd>{v === "the address you copied" ? <em>{v}</em> : <Code>{v}</Code>}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border bg-card/40 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
      <span className="font-medium text-foreground">Note. </span>
      {children}
    </p>
  );
}

function Prompt({ children }: { children: React.ReactNode }) {
  return (
    <li className="border-l-2 border-border pl-3 italic text-foreground/90">
      {children}
    </li>
  );
}

function Tool({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <>
      <dt>
        <Code>{name}</Code>
      </dt>
      <dd className="text-muted-foreground">{children}</dd>
    </>
  );
}

/** The address, with a copy button — nobody should retype a key by hand. */
function CopyRow({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5">
      <code className="min-w-0 flex-1 truncate font-mono text-xs">{value}</code>
      <button
        type="button"
        aria-label="Copy the address"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
          } catch {
            // Locked-down webviews refuse the clipboard; the address is on
            // screen either way.
            return;
          }
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {copied ? (
          <Check className="size-3.5 text-positive" aria-hidden />
        ) : (
          <Copy className="size-3.5" aria-hidden />
        )}
      </button>
    </div>
  );
}
