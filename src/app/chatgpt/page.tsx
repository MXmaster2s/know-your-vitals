"use client";

import { Addresses, Guide } from "@/components/connect-guide";

/** Behind sign-in — see AppShell. The content lives in connect-guide.tsx. */
export default function ConnectPage() {
  return <Guide addresses={<Addresses />} />;
}
