"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { StatusPill } from "@/components/korosha/status-pill";
import { IconArrowDown, IconArrowUp, IconMore, IconNote, IconPhone } from "@/components/korosha/icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type LeadRowData = {
  id: number;
  candidateId: number;
  name: string;
  email: string | null;
  phone: string | null;
  source: string;
  statusLabel: string;
  statusColor: string;
  appliedLabel: string;
  appliedISO: string;
  otherApplications: number;
  called: boolean;
};

const SOURCE_LABEL: Record<string, string> = {
  APPLY_FORM: "Apply page",
  EMAIL: "Email",
  REFERRAL: "Referral",
  MANUAL: "Manual",
};

/**
 * One lead, 36px, single line.
 *
 * Call is the loudest control on the row because getting a human on the phone
 * is the product goal; everything else is quieter or behind the menu. The row
 * itself is a button so a click opens the side panel — never a navigation, so
 * list position, scroll and filters survive.
 */
export function LeadRow({
  lead,
  selected,
  onOpen,
  onCall,
  onNote,
  onEmail,
  onArchive,
  onReject,
}: {
  lead: LeadRowData;
  selected: boolean;
  onOpen: () => void;
  onCall: () => void;
  onNote: () => void;
  onEmail: () => void;
  onArchive: () => void;
  onReject: () => void;
}) {
  // Stops a control inside the row from also opening the panel.
  const stop = (fn: () => void) => (event: React.MouseEvent) => {
    event.stopPropagation();
    fn();
  };

  return (
    <div
      role="row"
      tabIndex={0}
      aria-current={selected || undefined}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className={`ui-row lead-grid h-[var(--row-h)] cursor-pointer items-center border-b border-[var(--line)] px-[var(--space-3)] last:border-0 ${
        selected
          ? "ui-row-selected bg-[var(--surface-selected)]"
          : "hover:bg-[var(--surface-hover)]"
      }`}
    >
      <span className="k-cell flex items-center gap-[var(--space-2)]">
        <span className="k-cell text-sm font-medium">{lead.name}</span>
        {lead.otherApplications > 0 && (
          <span
            title={`This person has ${lead.otherApplications} other application${lead.otherApplications === 1 ? "" : "s"} — check before calling`}
            className="shrink-0 rounded-[3px] bg-[var(--surface-sunken)] px-1 text-2xs font-medium text-[var(--foreground)]"
          >
            +{lead.otherApplications}
          </span>
        )}
      </span>

      <span className="k-cell text-sm text-[var(--ink-muted)]">
        {SOURCE_LABEL[lead.source] ?? lead.source}
      </span>

      <span className="k-cell">
        <StatusPill color={lead.statusColor} label={lead.statusLabel} />
      </span>

      {/* Time since applied is the fastest-reading value on the row. When a
          lead has never been called it carries a marker and full ink, because
          an uncalled lead's age is the number that matters. */}
      <span
        title={new Date(lead.appliedISO).toLocaleString()}
        className={`k-cell k-tnum flex items-center justify-end gap-1 text-right text-sm ${
          lead.called ? "text-[var(--ink-muted)]" : "font-medium text-[var(--foreground)]"
        }`}
      >
        {!lead.called && (
          <span
            aria-label="Not called yet"
            title="Not called yet"
            className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--foreground)]"
          />
        )}
        {lead.appliedLabel}
      </span>

      <span className="flex items-center justify-end gap-[var(--space-1)]">
        <button
          type="button"
          onClick={stop(onCall)}
          disabled={!lead.phone}
          title={lead.phone ? `Call ${lead.name}` : "No phone number on file"}
          className="ui-button inline-flex h-6 items-center gap-1 rounded-[4px] bg-[var(--primary)] px-[var(--space-2)] text-2xs font-medium text-[var(--on-primary)] hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <IconPhone size={11} />
          Call
        </button>

        <button
          type="button"
          onClick={stop(onNote)}
          aria-label={`Add a note about ${lead.name}`}
          title="Add a note"
          className="ui-button inline-flex h-6 w-6 items-center justify-center rounded-[4px] border border-[var(--line)] text-[var(--ink-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
        >
          <IconNote size={12} />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger
            onClick={(event) => event.stopPropagation()}
            aria-label={`More actions for ${lead.name}`}
            className="ui-button inline-flex h-6 w-6 items-center justify-center rounded-[4px] text-[var(--ink-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
          >
            <IconMore size={13} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEmail}>Email</DropdownMenuItem>
            <DropdownMenuItem onSelect={onOpen}>View application</DropdownMenuItem>
            <DropdownMenuItem onSelect={onArchive}>Move to History</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onReject}>Reject</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
    </div>
  );
}

export type LeadSortColumn = "name" | "source" | "status" | "appliedAt";

/** The active sort and, per column, the link that sorts by it. Built on the server from the URL. */
export type LeadSort = {
  column: LeadSortColumn;
  dir: "asc" | "desc";
  hrefs: Record<LeadSortColumn, string>;
};

function SortHeading({
  sort,
  column,
  children,
  className = "",
}: {
  sort?: LeadSort;
  column: LeadSortColumn;
  children: ReactNode;
  className?: string;
}) {
  if (!sort) return <span role="columnheader" className={className}>{children}</span>;
  const active = sort.column === column;
  return (
    <span
      role="columnheader"
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={className}
    >
      <Link
        href={sort.hrefs[column]}
        className={`hover:text-[var(--foreground)] ${active ? "text-[var(--foreground)]" : ""}`}
      >
        {children}
        {/* The slot is always there, so toggling the sort never shifts the heading. */}
        <span aria-hidden="true" className="ml-[var(--space-1)] inline-flex w-[1em] align-[-0.125em]">
          {active && (sort.dir === "asc" ? <IconArrowUp size="1em" /> : <IconArrowDown size="1em" />)}
        </span>
      </Link>
    </span>
  );
}

/** Column headings. Shares .lead-grid with the rows so they cannot drift. */
export function LeadHead({ children, sort }: { children?: ReactNode; sort?: LeadSort }) {
  return (
    <div
      role="row"
      className="lead-grid ui-sticky-head h-8 items-center border-b border-[var(--line)] px-[var(--space-3)] text-2xs font-medium uppercase tracking-wide text-[var(--ink-faint)]"
    >
      {children ?? (
        <>
          <SortHeading sort={sort} column="name">Lead</SortHeading>
          <SortHeading sort={sort} column="source">Source</SortHeading>
          <SortHeading sort={sort} column="status">Status</SortHeading>
          <SortHeading sort={sort} column="appliedAt" className="text-right">Applied</SortHeading>
          <span role="columnheader" className="text-right">Actions</span>
        </>
      )}
    </div>
  );
}
