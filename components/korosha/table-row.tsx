"use client";

import type { HTMLAttributes, KeyboardEvent, ReactNode } from "react";

/**
 * A lead row.
 *
 * Rows deliberately have NO transition: a recruiter crosses hundreds an hour
 * and a fading hover tint lags behind the pointer.
 *
 * When `onOpen` is given the row becomes a button in the accessibility tree —
 * the spec wants a row click to open the side panel, never a page navigation,
 * and a div with an onClick is invisible to a keyboard.
 */
export function KTableRow({
  children,
  onOpen,
  selected = false,
  muted = false,
  className = "",
  ...props
}: Omit<HTMLAttributes<HTMLDivElement>, "onClick"> & {
  children: ReactNode;
  onOpen?: () => void;
  selected?: boolean;
  /** Auto-rejected leads: still visible, visibly de-emphasized. */
  muted?: boolean;
}) {
  const interactive = Boolean(onOpen);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!onOpen) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen();
    }
  }

  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-current={selected || undefined}
      onClick={onOpen}
      onKeyDown={onKeyDown}
      className={[
        "ui-row flex items-center gap-[var(--space-3)] border-b border-[var(--line)] px-[var(--space-3)] py-[var(--space-2)] last:border-0",
        interactive ? "cursor-pointer" : "",
        selected
          ? "ui-row-selected bg-[var(--surface-selected)]"
          : "hover:bg-[var(--surface-hover)]",
        muted ? "opacity-60" : "",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}

/** Column headings for a KTableRow list. Sticky, with a scroll-edge shadow. */
export function KTableHead({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`ui-sticky-head flex items-center gap-[var(--space-3)] px-[var(--space-3)] py-[var(--space-1)] text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)] ${className}`}
    >
      {children}
    </div>
  );
}
