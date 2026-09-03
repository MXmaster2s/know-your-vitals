"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import posthog from "posthog-js";
import { useSession } from "@/components/auth-provider";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

/**
 * Product analytics for the people who arrive from a link — which paths they
 * open, how long they stay, whether they come back.
 *
 * What is deliberately NOT sent: anything from the data itself. No marker
 * names, no values, no meal contents, no prices. Pageviews carry the path and
 * nothing else, and the path never contains a reading. Identity is the
 * signed-in account, because knowing who followed a link is the point.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { session, ready } = useSession();
  const identified = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!KEY || posthog.__loaded) return;
    posthog.init(KEY, {
      api_host: HOST,
      ui_host: "https://us.posthog.com",
      // Client-side routing means Next never reloads the document, so
      // pageviews are captured by hand below.
      capture_pageview: false,
      capture_pageleave: true,
      // Same reasoning as the auth cookie: one visitor across subdomains.
      cross_subdomain_cookie: true,
      person_profiles: "always",
      defaults: "2025-05-24",
    });
  }, []);

  React.useEffect(() => {
    if (!KEY || !posthog.__loaded) return;
    posthog.capture("$pageview", { $current_url: window.location.origin + pathname });
  }, [pathname]);

  React.useEffect(() => {
    if (!KEY || !posthog.__loaded || !ready) return;
    const user = session?.user;
    if (user) {
      if (identified.current === user.id) return;
      identified.current = user.id;
      posthog.identify(user.id, {
        email: user.email,
        name: user.user_metadata?.full_name ?? user.user_metadata?.name,
        provider: user.app_metadata?.provider,
      });
    } else if (identified.current) {
      identified.current = null;
      posthog.reset();
    }
  }, [session, ready]);

  return <>{children}</>;
}
