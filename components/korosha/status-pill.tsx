import type { ReactNode } from "react";

/**
 * Renders a Status row from the database.
 *
 * Status.color stores a TOKEN NAME ("--status-accepted"), never a hex value, so
 * a recruiter creating a status in settings cannot introduce a color that sits
 * outside the palette or fails contrast on the dark ground.
 *
 * The fill is the status color at low alpha over a dark surface — the ink is
 * the full-strength color, which is the light end of each hue and clears 4.5:1.
 */

/** The swatches settings offers. Anything else falls back to neutral. */
export const STATUS_COLOR_TOKENS = [
  "--status-open",
  "--status-active",
  "--status-accepted",
  "--status-rejected",
  "--status-neutral",
] as const;

export type StatusColorToken = (typeof STATUS_COLOR_TOKENS)[number];

export function isStatusColorToken(value: string): value is StatusColorToken {
  return (STATUS_COLOR_TOKENS as readonly string[]).includes(value);
}

/** Unknown or legacy values degrade to neutral rather than rendering nothing. */
function resolve(color: string | null | undefined): StatusColorToken {
  return color && isStatusColorToken(color) ? color : "--status-neutral";
}

export function StatusPill({
  label,
  color,
  children,
  className = "",
}: {
  label?: ReactNode;
  color?: string | null;
  children?: ReactNode;
  className?: string;
}) {
  const token = resolve(color);

  return (
    <span
      className={`inline-flex min-h-5 shrink-0 items-center gap-[var(--space-1)] rounded-full px-[var(--space-2)] text-xs font-semibold uppercase leading-none tracking-wide ${className}`}
      style={{
        // color-mix keeps the fill derived from one token, so a palette edit
        // propagates without touching this file. Pale fill, full-strength ink.
        color: `var(${token})`,
        backgroundColor: `color-mix(in oklab, var(${token}) 16%, transparent)`,
      }}
    >
      {children ?? label}
    </span>
  );
}

/** A bare dot, for dense rows where a full pill costs too much width. */
export function StatusDot({ color, title }: { color?: string | null; title?: string }) {
  const token = resolve(color);
  return (
    <span
      aria-hidden="true"
      title={title}
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: `var(${token})` }}
    />
  );
}
