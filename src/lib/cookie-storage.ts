/**
 * Session storage in cookies rather than localStorage, so a sign-in on
 * app.example.com is still a sign-in on any other example.com subdomain.
 * localStorage is per-origin; cookies can be scoped to a parent domain, and
 * that is the whole reason this file exists.
 *
 * Two things make it more than a one-liner:
 *
 *  - **Size.** A Supabase session carrying Google profile metadata runs past
 *    the 4 KB per-cookie limit, so values are chunked across `key.0`, `key.1`…
 *    A single oversized cookie is silently dropped by the browser, which would
 *    look exactly like being randomly signed out.
 *  - **SameSite.** It must be `Lax`, not `Strict` — the OAuth redirect back
 *    from Google is a cross-site top-level navigation, and `Strict` would
 *    withhold the cookie on precisely that request.
 */

const CHUNK = 3000; // encoded chars; comfortably under the 4 KB cookie limit
const MAX_CHUNKS = 12;
const MAX_AGE = 60 * 60 * 24 * 400; // 400 days — the ceiling Chrome allows

/** ".example.com" for a host of app.example.com; nothing on localhost, where
 *  a dot-domain is invalid and the cookie would simply never be set. */
function cookieDomain(): string {
  if (typeof window === "undefined") return "";
  const host = window.location.hostname;
  const parts = host.split(".");
  if (parts.length < 2 || host === "localhost") return "";
  return `; domain=.${parts.slice(-2).join(".")}`;
}

function secure(): string {
  return typeof window !== "undefined" && window.location.protocol === "https:"
    ? "; secure"
    : "";
}

function read(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${encodeURIComponent(name)}=`;
  for (const part of document.cookie.split("; ")) {
    if (part.startsWith(prefix)) return part.slice(prefix.length);
  }
  return null;
}

function write(name: string, value: string) {
  document.cookie =
    `${encodeURIComponent(name)}=${value}; path=/; max-age=${MAX_AGE}` +
    `; samesite=lax${cookieDomain()}${secure()}`;
}

function erase(name: string) {
  document.cookie =
    `${encodeURIComponent(name)}=; path=/; max-age=0` +
    `; samesite=lax${cookieDomain()}${secure()}`;
}

export const cookieStorage = {
  getItem(key: string): string | null {
    const parts: string[] = [];
    for (let i = 0; i < MAX_CHUNKS; i++) {
      const c = read(`${key}.${i}`);
      if (c === null) break;
      parts.push(c);
    }
    const raw = parts.length > 0 ? parts.join("") : read(key);
    if (raw === null) return null;
    try {
      return decodeURIComponent(raw);
    } catch {
      // A half-written or foreign cookie: treat as absent rather than throwing
      // inside the auth client, which would leave the app unable to boot.
      return null;
    }
  },

  setItem(key: string, value: string): void {
    if (typeof document === "undefined") return;
    this.removeItem(key);
    const encoded = encodeURIComponent(value);
    for (let i = 0; i * CHUNK < encoded.length; i++) {
      write(`${key}.${i}`, encoded.slice(i * CHUNK, (i + 1) * CHUNK));
    }
  },

  removeItem(key: string): void {
    if (typeof document === "undefined") return;
    erase(key);
    for (let i = 0; i < MAX_CHUNKS; i++) erase(`${key}.${i}`);
  },
};
