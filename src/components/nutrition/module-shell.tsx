"use client";

import * as React from "react";
import { ChevronLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * The frame every editing module shares.
 *
 * Modules stack — a day opens a meal, a meal opens an ingredient, an
 * ingredient opens its unit — so each one needs a way back that lands on the
 * one beneath rather than dismissing the lot. The arrow at the top left and a
 * tap outside do the same thing, which is close only this layer.
 */
export function ModuleShell({
  title,
  subtitle,
  onBack,
  className,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  onBack: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onBack()}>
      <DialogContent
        showCloseButton={false}
        className={cn("max-h-[85dvh] overflow-y-auto sm:max-w-lg", className)}
      >
        <DialogHeader className="space-y-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onBack}
              aria-label="Back"
              className="-ml-1.5 grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <DialogTitle className="font-serif text-lg">{title}</DialogTitle>
          </div>
          {subtitle ? (
            <DialogDescription className="pl-7">{subtitle}</DialogDescription>
          ) : (
            <DialogDescription className="sr-only">
              {title} — press Back to return.
            </DialogDescription>
          )}
        </DialogHeader>
        {/* The panel is a grid, and a grid column will not shrink below its
            widest unbreakable line — one long product URL would otherwise
            push every field past the edge. */}
        <div className="min-w-0">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
