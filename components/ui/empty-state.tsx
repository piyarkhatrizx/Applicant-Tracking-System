import { Button } from "./button";

export type EmptyStateAction = {
  label: string;
  onClick?: () => void;
  href?: string;
};

/**
 * Wayfinding, not decoration: say what is missing, why, and the one thing to do
 * next. Plain text, no box and no icon. `compact` (or `size="compact"`) fits
 * inside a list body without pushing the page down.
 */
export function EmptyState({
  title,
  description,
  action,
  secondaryAction,
  size = "default",
  compact = false,
  className = "",
}: {
  title: string;
  description?: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  size?: "default" | "compact";
  compact?: boolean;
  className?: string;
}) {
  const isCompact = compact || size === "compact";

  return (
    <div
      className={`px-[var(--space-4)] text-center ${
        isCompact ? "py-[var(--space-6)]" : "py-[var(--space-12)]"
      } ${className}`}
    >
      <p className={`font-semibold text-[var(--foreground)] ${isCompact ? "text-sm" : "text-lg"}`}>{title}</p>
      {description && (
        <p className="mx-auto mt-[var(--space-1)] max-w-sm text-sm text-[var(--ink-muted)]">{description}</p>
      )}
      {(action || secondaryAction) && (
        <div className="mt-[var(--space-4)] flex items-center justify-center gap-[var(--space-2)]">
          {action && <ActionButton action={action} variant="primary" />}
          {secondaryAction && <ActionButton action={secondaryAction} variant="secondary" />}
        </div>
      )}
    </div>
  );
}

function ActionButton({ action, variant }: { action: EmptyStateAction; variant: "primary" | "secondary" }) {
  if (action.href) {
    return (
      <Button variant={variant} asChild>
        <a href={action.href}>{action.label}</a>
      </Button>
    );
  }

  return (
    <Button variant={variant} onClick={action.onClick}>
      {action.label}
    </Button>
  );
}
