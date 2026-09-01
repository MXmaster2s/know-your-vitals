import { createClient } from "@supabase/supabase-js";

// Browser client for the static export. NEXT_PUBLIC_* values are inlined at
// build time — URL + anon key only; RLS on the Pi is the security boundary.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  }
);
