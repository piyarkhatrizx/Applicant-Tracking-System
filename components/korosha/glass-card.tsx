import type { HTMLAttributes, ReactNode } from "react";

/**
 * The panel. A floating white card on the gray-50 canvas: rounded-3xl,
 * border-gray-100, shadow-card. The name is historical: it no longer blurs,
 * because a backdrop-filter per card repainted on every scroll frame and made
 * analytics lag. Glass is for the nav and toasts only.
 */
export function GlassCard({
  children,
  className = "",
  // Kept so existing callers compile; every card is flat now.
  flat: _flat = false,
  padded = true,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  /** No effect: every card is a solid surface. Kept for API compatibility. */
  flat?: boolean;
  padded?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-card)] ${padded ? "p-[var(--space-6)]" : ""} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

/** Header row inside a card: a title, and optional actions on the right. */
export function GlassCardHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-[var(--space-3)] flex flex-wrap items-start justify-between gap-[var(--space-3)]">
      <div className="min-w-0">
        <h2 className="truncate text-md font-semibold text-[var(--foreground)]">
          {title}
        </h2>
        {description && (
          <p className="mt-[var(--space-1)] text-sm text-[var(--ink-muted)]">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-[var(--space-2)]">{actions}</div>}
    </div>
  );
}
