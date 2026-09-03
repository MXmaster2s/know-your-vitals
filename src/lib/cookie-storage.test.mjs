// Run:  npx tsc src/lib/cookie-storage.ts --target es2020 --module esnext \
//         --moduleResolution bundler --outFile src/lib/cookie-storage.compiled.mjs
//       node src/lib/cookie-storage.test.mjs
// a cookie jar that behaves like document.cookie, including the 4096-byte
// per-cookie limit browsers silently enforce
const jar = new Map();
let dropped = 0;
globalThis.window = { location: { hostname: "app.example.com", protocol: "https:" } };
globalThis.document = {
  get cookie() {
    return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  },
  set cookie(str) {
    const [pair, ...attrs] = str.split("; ");
    const eq = pair.indexOf("=");
    const name = pair.slice(0, eq), value = pair.slice(eq + 1);
    const maxAge = attrs.find((a) => a.startsWith("max-age="));
    if (maxAge === "max-age=0") { jar.delete(name); return; }
    if (pair.length > 4096) { dropped++; return; }   // browser drops it
    jar.set(name, value);
  },
};
const { cookieStorage: cs } = await import("./cookie-storage.compiled.mjs");

let pass = 0, fail = 0;
const check = (name, ok, extra = "") =>
  ok ? (pass++, console.log(`  ok    ${name}`)) : (fail++, console.log(`  FAIL  ${name} ${extra}`));

// 1. a small value round-trips
cs.setItem("sb-auth-token", "hello");
check("small value round-trips", cs.getItem("sb-auth-token") === "hello");

// 2. a realistic Supabase session with Google metadata (~6 KB)
const session = JSON.stringify({
  access_token: "e" + "y".repeat(3200),
  refresh_token: "r".repeat(60),
  expires_at: 1788888888,
  user: {
    id: "0d5e1c2b-1111-4222-8333-444455556666",
    email: "someone.with.a.long.address@gmail.com",
    user_metadata: {
      full_name: "A Guest From Instagram",
      avatar_url: "https://lh3.googleusercontent.com/a/" + "A".repeat(180),
      picture: "https://lh3.googleusercontent.com/a/" + "B".repeat(180),
      locale: "en-GB", provider_id: "1".repeat(21), sub: "1".repeat(21),
    },
    app_metadata: { provider: "google", providers: ["google"] },
    identities: [{ id: "x".repeat(64), identity_data: { avatar_url: "c".repeat(220) } }],
  },
});
cs.setItem("sb-auth-token", session);
check(`large session (${session.length} chars) round-trips`, cs.getItem("sb-auth-token") === session);
check("it was split into chunks", [...jar.keys()].filter((k) => k.includes(".")).length > 1,
      `chunks=${[...jar.keys()].length}`);
check("every chunk is under 4 KB", [...jar.entries()].every(([k, v]) => (k + "=" + v).length <= 4096));
check("no cookie exceeded the 4 KB limit", dropped === 0, `dropped=${dropped}`);

// 3. shrinking back must not leave stale chunks behind
cs.setItem("sb-auth-token", "small again");
check("shrink clears old chunks", cs.getItem("sb-auth-token") === "small again",
      `got=${JSON.stringify(cs.getItem("sb-auth-token"))?.slice(0, 40)}`);

// 4. values with cookie-hostile characters
const nasty = 'a;b=c,d "e" \\f\n{"json":true}';
cs.setItem("k", nasty);
check("separators and quotes survive", cs.getItem("k") === nasty);

// 5. removal
cs.removeItem("sb-auth-token");
check("removeItem clears it", cs.getItem("sb-auth-token") === null);
check("missing key returns null", cs.getItem("never-set") === null);

// 6. the domain is the parent, and flags are right for OAuth
let last = "";
document.__defineSetter__ ? null : null;
const realSet = Object.getOwnPropertyDescriptor(globalThis.document, "cookie").set;
Object.defineProperty(globalThis.document, "cookie", {
  set(v) { last = v; realSet.call(this, v); },
  get() { return [...jar.entries()].map(([k, val]) => `${k}=${val}`).join("; "); },
});
cs.setItem("probe", "v");
check("scoped to .example.com", last.includes("domain=.example.com"), last);
check("samesite=lax (Strict would break the OAuth return)", last.includes("samesite=lax"));
check("secure on https", last.includes("secure"));

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
