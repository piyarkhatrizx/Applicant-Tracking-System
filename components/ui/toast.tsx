"use client";

import { Toaster as SonnerToaster, toast } from "sonner";

/**
 * Sonner: swipe-to-dismiss, stacking, timer pause on tab blur and hover, and a
 * `toast()` call that works from anywhere without context. Mount once in the
 * root layout.
 *
 * Bottom-right, not center: a recruiter's eyes live in the list, and a toast
 * that covers the row they just acted on is a regression.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      gap={8}
      offset={16}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "k-glass flex w-full items-center gap-[var(--space-2)] border border-[var(--line)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--foreground)] shadow-[var(--shadow-overlay)]",
          title: "font-semibold",
          description: "text-[var(--ink-muted)]",
          actionButton:
            "ui-button ml-auto inline-flex h-6 shrink-0 items-center border border-transparent bg-[var(--primary)] px-[var(--space-2)] text-xs font-semibold text-[var(--on-primary)] hover:bg-[var(--primary-hover)]",
          cancelButton:
            "ui-button inline-flex h-6 shrink-0 items-center border border-[var(--line)] px-[var(--space-2)] text-xs font-semibold",
          error: "text-[var(--status-rejected)]",
          success: "text-[var(--status-accepted)]",
        },
      }}
    />
  );
}

export { toast };
