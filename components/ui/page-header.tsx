import Link from "next/link";
import type { ReactNode } from "react";
import { SectionLabel } from "./section-label";

export type Crumb = { label: string; href?: string };

/**
 * The one header every route uses. Chrome stays quiet: a single row of title
 * plus actions, so the content starts near the top of the viewport instead of
 * a screenful down.
 *
 * No rule underneath (the nav already draws one), and the header owns the one
 * layout gap between itself and the page content: --space-6, 24px on the 8pt
 * grid. Pages do not add their own top margin to the first block below it.
 *
 * `eyebrow` is for context the title does not carry, such as the job posting a
 * view is filtered to. Never a restatement of the page or nav item.
 */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  breadcrumb,
  actions,
  className = "",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  breadcrumb?: Crumb[];
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={`mb-[var(--space-6)] ${className}`}>
      {breadcrumb && breadcrumb.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-[var(--space-1)]">
          <ol className="flex flex-wrap items-center gap-[var(--space-1)] text-xs text-[var(--ink-muted)]">
            {breadcrumb.map((crumb, index) => (
              <li key={`${crumb.label}-${index}`} className="flex items-center gap-[var(--space-1)]">
                {crumb.href ? (
                  <Link href={crumb.href} className="text-[var(--foreground)] underline-offset-2 hover:underline">
                    {crumb.label}
                  </Link>
                ) : (
                  <span aria-current="page">{crumb.label}</span>
                )}
                {index < breadcrumb.length - 1 && (
                  <span aria-hidden="true" className="text-[var(--line)]">
                    /
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-wrap items-center justify-between gap-[var(--space-3)]">
        <div className="min-w-0">
          {eyebrow && <SectionLabel>{eyebrow}</SectionLabel>}
          <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-[var(--space-1)] text-sm text-[var(--ink-muted)]">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-[var(--space-2)]">{actions}</div>}
      </div>
    </header>
  );
}
