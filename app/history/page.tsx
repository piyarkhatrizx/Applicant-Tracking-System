import Link from "next/link";
import { HistoryButton } from "@/components/history-button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/korosha/status-pill";
import { LeadHead } from "@/components/leads/lead-row";
import { PageHeader } from "@/components/ui/page-header";
import { getArchive, sinceLabel } from "@/lib/leads/query";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "History | Korosha",
  description: "Applications moved to History, with restore.",
};

export default function HistoryPage() {
  const inHistory = getArchive();
  const now = Date.now();

  return (
    <main className="min-h-screen">
      <div className="k-shell">
        <PageHeader
          title="History"
          subtitle={`${inHistory.length} application${inHistory.length === 1 ? "" : "s"} in History, most recently moved first. Hidden from Current Status, still counted in analytics.`}
        />

        {inHistory.length === 0 ? (
          <EmptyState title="History is empty" description="Move an application to History from its candidate record." />
        ) : (
          <div className="mt-[var(--space-6)] rounded-lg bg-[var(--surface)] p-[var(--space-2)] shadow-[var(--shadow-elevated)]">
            <div className="grid grid-cols-1 gap-[var(--space-6)] lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="min-w-0 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
                <LeadHead>
                  <span role="columnheader">Applicant</span>
                  <span role="columnheader">Job posting</span>
                  <span role="columnheader">Status</span>
                  <span role="columnheader" className="text-right">Moved</span>
                  <span role="columnheader" className="text-right">Actions</span>
                </LeadHead>
                {inHistory.map(({ application, candidate, status, job }) => {
                  const name = [candidate.firstName, candidate.lastName].filter(Boolean).join(" ") || "Unnamed applicant";
                  return (
                    <div
                      key={application.id}
                      role="row"
                      className="lead-grid h-[var(--row-h)] items-center border-b border-[var(--line)] px-[var(--space-3)] last:border-0"
                    >
                      <Link
                        href={`/candidates/${candidate.id}`}
                        className="k-cell text-sm font-medium hover:underline"
                      >
                        {name}
                      </Link>
                      <span className="k-cell text-sm text-[var(--ink-muted)]">
                        {job ? `${job.code} · ${job.title}` : "—"}
                      </span>
                      <span className="k-cell">
                        <StatusPill color={status.color} label={status.label} />
                      </span>
                      <span
                        title={application.archivedAt!.toLocaleString()}
                        className="k-cell k-tnum text-right text-sm text-[var(--ink-muted)]"
                      >
                        {sinceLabel(application.archivedAt!, now)} ago
                      </span>
                      <span className="flex justify-end">
                        <HistoryButton applicationId={application.id} inHistory />
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col gap-[var(--space-4)]">
                <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-[var(--space-4)] shadow-[var(--shadow-card)]">
                  <p className="text-2xs font-medium uppercase tracking-wide text-[var(--ink-faint)]">In History</p>
                  <p className="mt-[var(--space-1)] text-2xl font-semibold text-[var(--foreground)]">{inHistory.length}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
