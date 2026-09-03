import { createClient } from "@supabase/supabase-js";
import { cookieStorage } from "@/lib/cookie-storage";

// Browser client for the static export. NEXT_PUBLIC_* values are inlined at
// build time — URL + anon key only; RLS on the Pi is the security boundary.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // OAuth hands the session back in the URL on return from the provider;
      // with this off the redirect completes and then appears to do nothing.
      detectSessionInUrl: true,
      flowType: "pkce",
      // Cookies on the parent domain instead of per-origin localStorage, so
      // one sign-in covers every subdomain. See cookie-storage.ts.
      storage: typeof window === "undefined" ? undefined : cookieStorage,
    },
  }
);
