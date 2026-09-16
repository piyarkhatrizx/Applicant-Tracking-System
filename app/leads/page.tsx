import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { IconArrowLeft, IconArrowRight } from "@/components/korosha/icon";
import { LeadInbox } from "@/components/leads/lead-inbox";
import type { LeadRowData, LeadSort, LeadSortColumn } from "@/components/leads/lead-row";
import { getActiveStatuses } from "@/lib/application-status";
import { APPLICATION_SOURCES, sourceLabel } from "@/lib/application-source";
import { findJob } from "@/lib/data";
import { getLeadInbox, sinceLabel } from "@/lib/leads/query";
import { PAGE_SIZE, parseListParams, withParam, type ListSearchParams, type SortKey } from "@/lib/list-params";

/** What the subtitle says for each sort, so it never claims an order the table is not in. */
const SORT_DESCRIPTION: Record<SortKey<"leads">, Record<"asc" | "desc", string>> = {
  appliedAt: { desc: "newest first", asc: "oldest first" },
  name: { asc: "by last name, A to Z", desc: "by last name, Z to A" },
  status: { asc: "by stage, earliest first", desc: "by stage, latest first" },
  source: { asc: "by source, A to Z", desc: "by source, Z to A" },
};

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Leads | Korosha",
  description: "Every lead, newest first. Speed to first contact.",
};

function FilterChip({
  href,
  active,
  label,
  count,
  marker,
}: {
  href: string;
  active: boolean;
  label: string;
  count?: number;
  marker?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex h-7 items-center gap-[var(--space-2)] rounded-[4px] border px-[var(--space-3)] text-xs font-medium ${
        active
          ? "border-[var(--accent-line)] bg-[var(--surface-selected)] text-[var(--foreground)]"
          : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
      }`}
    >
      {marker && <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--foreground)]" />}
      {label}
      {count !== undefined && <span className="k-tnum text-[var(--ink-faint)]">{count}</span>}
    </Link>
  );
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<ListSearchParams>;
}) {
  const query = await searchParams;
  const params = parseListParams("leads", query);

  const { rows, matching, counts } = getLeadInbox(params);
  const statuses = getActiveStatuses();
  const job = params.job ? findJob(params.job) : null;

  const now = Date.now();
  const leads: LeadRowData[] = rows.map(({ application, candidate, status, called, otherApplicationCount }) => ({
    id: application.id,
    candidateId: candidate.id,
    name: [candidate.firstName, candidate.lastName].filter(Boolean).join(" ") || "Unnamed lead",
    email: candidate.email,
    phone: candidate.phone,
    source: application.source,
    statusLabel: status.label,
    statusColor: status.color,
    appliedLabel: sinceLabel(application.appliedAt, now),
    appliedISO: application.appliedAt.toISOString(),
    otherApplications: otherApplicationCount,
    called,
  }));

  const statusOptions = statuses.map((status) => ({
    id: status.id,
    label: status.label,
    color: status.color,
    isTerminal: status.isTerminal,
  }));

  const base = "/leads";
  const link = (key: string, value: string | null) => `${base}${withParam(query, key, value)}`;

  // The active column flips direction; any other column sorts in its natural direction.
  const sortColumns: LeadSortColumn[] = ["name", "source", "status", "appliedAt"];
  const sort: LeadSort = {
    column: params.sort,
    dir: params.dir,
    hrefs: Object.fromEntries(
      sortColumns.map((column) => [
        column,
        column === params.sort
          ? link("dir", params.dir === "asc" ? "desc" : "asc")
          : `${base}${withParam({ ...query, dir: undefined }, "sort", column)}`,
      ]),
    ) as Record<LeadSortColumn, string>,
  };

  return (
    <main className="min-h-screen">
      <div className="k-shell">
        <PageHeader
          eyebrow={job ? `${job.code} · ${job.title}` : undefined}
          title="Leads"
          subtitle={`${matching} lead${matching === 1 ? "" : "s"}${params.q ? ` matching "${params.q}"` : ""}, ${SORT_DESCRIPTION[params.sort][params.dir]}`}
          actions={
            params.job ? (
              <Link
                href="/leads"
                className="text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--foreground)]"
              >
                Clear job posting filter
              </Link>
            ) : undefined
          }
        />

        {/* A plain GET form. The other filters ride along as hidden fields, so a
            search narrows the current view instead of replacing it. */}
        <form action={base} role="search" className="flex flex-wrap items-center gap-[var(--space-2)]">
          {(["source", "status", "job", "uncalled", "sort", "dir"] as const).map((key) => {
            const value = query[key];
            const single = Array.isArray(value) ? value[0] : value;
            return single ? <input key={key} type="hidden" name={key} value={single} /> : null;
          })}
          <label htmlFor="lead-search" className="sr-only">
            Search leads by name, email or phone
          </label>
          <input
            id="lead-search"
            name="q"
            type="search"
            defaultValue={params.q ?? ""}
            placeholder="Search name, email or phone"
            className="h-8 w-72 max-w-full rounded-[4px] border border-[var(--line)] bg-[var(--surface)] px-[var(--space-2)] text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--ink-faint)] focus:border-[var(--accent-line)]"
          />
          <Button variant="secondary" type="submit" size="sm">
            Search
          </Button>
          {params.q && (
            <Link
              href={link("q", null)}
              className="text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--foreground)]"
            >
              Clear search
            </Link>
          )}
        </form>

        {/* Uncalled sits first and carries the accent dot: an uncalled lead is
            the whole point of the screen, so it is one click from anywhere. */}
        <nav aria-label="Filter leads" className="mt-[var(--space-3)] flex flex-wrap gap-[var(--space-2)]">
          <FilterChip
            href={link("uncalled", params.uncalled ? null : "1")}
            active={params.uncalled}
            label="Uncalled"
            count={counts.uncalled}
            marker
          />
          <span className="mx-[var(--space-1)] w-px self-stretch bg-[var(--line)]" aria-hidden="true" />
          <FilterChip href={link("source", null)} active={!params.source} label="All sources" count={counts.total} />
          {APPLICATION_SOURCES.map((source) => (
            <FilterChip
              key={source}
              href={link("source", source)}
              active={params.source === source}
              label={sourceLabel[source]}
              count={counts.bySource.get(source) ?? 0}
            />
          ))}
        </nav>

        <div className="mt-[var(--space-3)] flex flex-wrap gap-[var(--space-2)]">
          <FilterChip href={link("status", null)} active={!params.status} label="Any stage" />
          {statuses.map((status) => (
            <FilterChip
              key={status.id}
              href={link("status", status.key)}
              active={params.status === status.key}
              label={status.label}
            />
          ))}
        </div>

        <div className="mt-[var(--space-4)]">
          <LeadInbox
            leads={leads}
            statuses={statusOptions}
            sort={sort}
            emptyHint={
              params.q
                ? `No leads match "${params.q}" with these filters.`
                : params.uncalled
                  ? "Every lead in this view has been called."
                  : "Leads appear here the moment an application arrives."
            }
          />
        </div>

        {matching > PAGE_SIZE && (
          <nav
            aria-label="Pagination"
            className="mt-[var(--space-4)] flex items-center justify-between border-t border-[var(--line)] pt-[var(--space-3)] text-sm"
          >
            <span className="k-tnum text-[var(--ink-muted)]">
              {params.skip + 1}–{Math.min(params.skip + PAGE_SIZE, matching)} of {matching}
            </span>
            <span className="flex gap-[var(--space-4)]">
              {params.page > 1 && (
                <Link className="font-medium text-[var(--foreground)]" href={link("page", String(params.page - 1))}>
                  <IconArrowLeft size="1em" className="inline-block align-[-0.125em]" /> Previous
                </Link>
              )}
              {params.skip + PAGE_SIZE < matching && (
                <Link className="font-medium text-[var(--foreground)]" href={link("page", String(params.page + 1))}>
                  Next <IconArrowRight size="1em" className="inline-block align-[-0.125em]" />
                </Link>
              )}
            </span>
          </nav>
        )}
      </div>
    </main>
  );
}
