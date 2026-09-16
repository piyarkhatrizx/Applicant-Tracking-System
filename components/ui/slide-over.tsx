"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { DialogClose } from "./dialog";
import { SectionLabel } from "./section-label";

/**
 * Same Radix primitive as Dialog, anchored to the right edge. It enters and
 * exits along the same path, so a resume panel always leaves the way it arrived.
 * Header, body and footer are separated by space, not rules.
 */
export function SlideOver({
  open,
  onOpenChange,
  title,
  eyebrow,
  description,
  footer,
  children,
  className = "",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  eyebrow?: string;
  description?: string;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="ui-scrim fixed inset-0 z-40 bg-[var(--scrim)]" />
        <RadixDialog.Content
          className={`ui-slide-panel fixed inset-y-0 right-0 z-50 flex w-[min(94vw,34rem)] flex-col bg-[var(--surface)] text-[var(--foreground)] shadow-[var(--shadow-overlay)] ${className}`}
        >
          <header className="flex items-start justify-between gap-[var(--space-4)] px-[var(--space-5)] pt-[var(--space-5)]">
            <div className="min-w-0">
              {eyebrow && <SectionLabel>{eyebrow}</SectionLabel>}
              <RadixDialog.Title className="text-lg font-semibold tracking-tight">{title}</RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className="mt-[var(--space-1)] text-sm text-[var(--ink-muted)]">
                  {description}
                </RadixDialog.Description>
              ) : (
                <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
              )}
            </div>
            <DialogClose label="Close panel" />
          </header>
          <div className="flex-1 overflow-y-auto px-[var(--space-5)] py-[var(--space-4)]">{children}</div>
          {footer && (
            <footer className="flex items-center justify-end gap-[var(--space-2)] px-[var(--space-5)] pb-[var(--space-5)] pt-[var(--space-2)]">
              {footer}
            </footer>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
