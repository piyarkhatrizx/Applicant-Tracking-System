"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Toaster } from "@/components/ui/toast";

/**
 * Leads and the design system are deliberately absent. Their routes still exist
 * (the design system only while developing); nothing in the UI links to them.
 * Current Status (the board) is gone too: its job was browsing by status,
 * which the Status filter on Applicants now does in one flat list instead of
 * a column per stage.
 */
export const NAV = [
  { href: "/analytics", label: "Analytics" },
  { href: "/applicants", label: "Applicants" },
  { href: "/history", label: "History" },
  { href: "/settings/statuses", label: "Settings" },
];

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  href,
  label,
  active,
  onNavigate,
  className = "",
}: {
  href: string;
  label: string;
  active: boolean;
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={`ui-button flex h-9 items-center rounded-xl px-[var(--space-3)] text-sm transition-colors duration-[var(--duration-press)] ${
        active
          ? "bg-[var(--accent-tint)] font-medium text-[var(--accent-deep)]"
          : "text-[var(--ink-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
      } ${className}`}
    >
      {label}
    </Link>
  );
}

/**
 * The site's one nav surface: a sticky top bar, white against the gray-50
 * canvas. Nav items are the light-blue accent pill when active. Below md the
 * links fold behind a menu button. The public /apply page removes the bar
 * entirely (AppShell below).
 */
function TopBar({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="k-glass sticky top-0 z-30 border-b border-[var(--glass-border)]">
      <div className="mx-auto flex h-14 w-full max-w-[var(--shell-width)] items-center justify-between gap-[var(--space-4)] px-[var(--shell-pad)]">
        <Link href="/analytics" className="text-sm font-semibold tracking-tight text-[var(--foreground)]">
          Korosha
        </Link>

        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex items-center gap-[var(--space-1)]">
            {NAV.map((item) => (
              <li key={item.href}>
                <NavLink href={item.href} label={item.label} active={isActive(pathname, item.href)} />
              </li>
            ))}
          </ul>
        </nav>

        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          className="ui-button flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] md:hidden"
        >
          <span aria-hidden="true" className="flex w-4 flex-col gap-[3px]">
            <span className="h-px w-full bg-current" />
            <span className="h-px w-full bg-current" />
            <span className="h-px w-full bg-current" />
          </span>
        </button>
      </div>

      {open && (
        <nav id="mobile-nav" aria-label="Main" className="k-mobile-nav border-t border-[var(--line)] md:hidden">
          <ul className="mx-auto flex w-full max-w-[var(--shell-width)] flex-col gap-[var(--space-1)] px-[var(--shell-pad)] py-[var(--space-2)]">
            {NAV.map((item) => (
              <li key={item.href}>
                <NavLink
                  href={item.href}
                  label={item.label}
                  active={isActive(pathname, item.href)}
                  onNavigate={() => setOpen(false)}
                />
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}

/**
 * The whole app's chrome: the top bar, absent on the public /apply page, plus
 * the gray-50 canvas background so no page sets it individually.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/apply") {
    return (
      <>
        {children}
        <Toaster />
      </>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <TopBar pathname={pathname} />
      <div id="main" key={pathname} className="k-route-fade min-w-0 flex-1 bg-[var(--background)]">
        {children}
      </div>
      <Toaster />
    </div>
  );
}
