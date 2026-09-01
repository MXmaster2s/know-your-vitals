"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Copies a block of text. Lives on every card so a single marker's history can
 * be pasted straight into a chat with an AI. stopPropagation keeps the click
 * from also opening the card behind it.
 */
export function CopyButton({
  getText,
  label,
  className,
}: {
  getText: () => string;
  label: string;
  className?: string;
}) {
  const [state, setState] = React.useState<"idle" | "done" | "error">("idle");

  React.useEffect(() => {
    if (state === "idle") return;
    const t = setTimeout(() => setState("idle"), 1600);
    return () => clearTimeout(t);
  }, [state]);

  async function copy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const text = getText();
    try {
      await navigator.clipboard.writeText(text);
      setState("done");
    } catch {
      // Clipboard API needs a secure context and can still be refused.
      // Fall back to a hidden textarea + execCommand before giving up.
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setState("done");
      } catch {
        setState("error");
      }
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={state === "done" ? "Copied" : label}
      title={state === "error" ? "Couldn't copy" : label}
      className={cn(
        "grid size-7 place-items-center rounded-lg transition-colors",
        "text-muted-foreground/60 hover:bg-muted hover:text-foreground",
        "focus-visible:outline-2 focus-visible:outline-ring/60",
        state === "done" && "text-positive",
        state === "error" && "text-attention",
        className
      )}
    >
      {state === "done" ? (
        <Check className="size-3.5" aria-hidden />
      ) : (
        <Copy className="size-3.5" aria-hidden />
      )}
    </button>
  );
}
