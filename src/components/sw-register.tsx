"use client";

import { useEffect } from "react";

/** Registers the service worker once, production only (dev assets must not
 *  end up in the shell cache). Renders nothing. */
export function SwRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }
  }, []);
  return null;
}
