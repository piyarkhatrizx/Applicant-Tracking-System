"use client";

import type { ReactNode } from "react";
import { SlideOver } from "@/components/ui/slide-over";

/**
 * The lead detail panel. A row click opens this — never a page navigation, so
 * the recruiter keeps their place in the list.
 *
 * Composed on components/ui/slide-over.tsx rather than replacing it: that
 * component already owns the Radix wiring, focus trap, escape handling and the
 * enter/exit-along-the-same-edge motion. All this adds is Korosha's structure.
 *
 * The panel is opaque (--surface), not glass: it sits above a scrolling list,
 * and blurring moving content behind a reading surface is exactly the stacked-
 * blur mush the spec forbids.
 */
export function SidePanel({
  open,
  onOpenChange,
  title,
  eyebrow,
  description,
  actions,
  footer,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  eyebrow?: string;
  description?: string;
  /** Primary actions, pinned under the header so they never scroll away. */
  actions?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <SlideOver
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      eyebrow={eyebrow}
      description={description}
      footer={footer}
    >
      {actions && (
        <div className="mb-[var(--space-4)] flex flex-wrap items-center gap-[var(--space-2)] border-b border-[var(--line)] pb-[var(--space-4)]">
          {actions}
        </div>
      )}
      {children}
    </SlideOver>
  );
}

/** A labelled block inside the panel. */
export function SidePanelSection({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`mb-[var(--space-5)] last:mb-0 ${className}`}>
      <h3 className="mb-[var(--space-2)] text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** Label/value pairs. Values wrap; labels never do. */
export function SidePanelField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-[var(--space-3)] border-b border-[var(--line)] py-[var(--space-1)] last:border-0">
      <dt className="w-28 shrink-0 text-sm text-[var(--ink-muted)]">{label}</dt>
      <dd className="min-w-0 flex-1 break-words text-sm">{children}</dd>
    </div>
  );
}
