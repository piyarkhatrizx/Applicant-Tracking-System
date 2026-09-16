import type { ElementType, ReactNode } from "react";

/**
 * The small uppercase eyebrow above a section. This exact class string was
 * pasted into seven files; one component means one place to change it.
 */
export function SectionLabel({
  children,
  as: Component = "p",
  tone = "accent",
  className = "",
}: {
  children: ReactNode;
  as?: ElementType;
  tone?: "accent" | "muted";
  className?: string;
}) {
  return (
    <Component
      className={`text-xs font-semibold uppercase tracking-wide ${
        tone === "accent" ? "text-[var(--foreground)]" : "text-[var(--ink-muted)]"
      } ${className}`}
    >
      {children}
    </Component>
  );
}
