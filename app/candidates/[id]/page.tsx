import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { SectionLabel } from "@/components/ui/section-label";
import { ApplicationStatusCell } from "@/components/application-status-cell";
import { ActivityTimeline } from "@/components/activity-timeline";
import { IconArrowRight } from "@/components/korosha/icon";
import { CallButton } from "@/components/call-button";
import { HistoryButton } from "@/components/history-button";
import { NoteComposer } from "@/components/note-composer";
import { getCandidateTimeline } from "@/lib/activity/timeline";
import { getActiveStatuses } from "@/lib/application-status";
import { findCandidate, listApplications, listJobs } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function CandidatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cursor?: string | string[] }>;
}) {
  const { id } = await params;
  const candidate = /^[1-9]\d{0,8}$/.test(id) ? findCandidate(Number(id)) : null;
  if (!candidate) notFound();

  const rawCursor = (await searchParams).cursor;
  const cursor = Array.isArray(rawCursor) ? rawCursor[0] : rawCursor;

  const name = [candidate.firstName, candidate.lastName].filter(Boolean).join(" ") || "Unnamed candidate";
  const jobTitles = new Map(listJobs().map((job) => [job.id, job.title]));
  // Most recent first. It is also the application a call from this page logs against.
  const applications = listApplications()
    .filter((application) => application.candidateId === candidate.id)
    .sort((a, b) => b.appliedAt.getTime() - a.appliedAt.getTime() || b.id - a.id);
  const timeline = getCandidateTimeline(candidate.id, { cursor });
  const statusOptions = getActiveStatuses().map((s) => ({
    id: s.id, label: s.label, color: s.color, isTerminal: s.isTerminal,
  }));

  return <main className="min-h-screen"><div className="k-shell">
    <PageHeader
      breadcrumb={[{ label: "Applicants", href: "/applicants" }, { label: name }]}
      title={name}
      subtitle={`${candidate.currentTitle ?? "Role not listed"}${candidate.currentEmployer ? ` · ${candidate.currentEmployer}` : ""}`}
      actions={<CallButton applicationId={applications[0]?.id ?? null} name={name} phone={candidate.phone} />}
    />
    <div className="mt-[var(--space-6)] rounded-lg bg-[var(--surface)] p-[var(--space-2)] shadow-[var(--shadow-elevated)]">
      <div className="grid gap-[var(--space-8)] p-[var(--space-4)] lg:grid-cols-[0.8fr_1.2fr]">
        <section className="self-start rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-[var(--space-6)] shadow-[var(--shadow-card)]"><SectionLabel as="h2">Contact</SectionLabel><dl className="mt-[var(--space-6)] space-y-[var(--space-4)] text-sm"><div><dt className="text-[var(--ink-muted)]">Email</dt><dd className="mt-[var(--space-1)]">{candidate.email ?? "—"}</dd></div><div><dt className="text-[var(--ink-muted)]">Phone</dt><dd className="mt-[var(--space-1)]">{candidate.phone ?? "—"}</dd></div><div><dt className="text-[var(--ink-muted)]">Location</dt><dd className="mt-[var(--space-1)]">{candidate.location ?? "—"}</dd></div><div><dt className="text-[var(--ink-muted)]">LinkedIn</dt><dd className="mt-[var(--space-1)] break-all">{candidate.linkedinUrl ?? "—"}</dd></div></dl><SectionLabel as="h2" className="mt-[var(--space-10)]">Applications</SectionLabel><ul className="mt-[var(--space-4)] space-y-[var(--space-3)] text-sm">{applications.map((application) => <li key={application.id} className="flex flex-wrap items-center justify-between gap-[var(--space-3)] border-b border-[var(--line)] pb-[var(--space-3)]"><span>{jobTitles.get(application.jobId) ?? "No job posting"}{application.archivedAt && <span className="ml-[var(--space-2)] text-[var(--ink-faint)]">In History</span>}</span><span className="flex items-center gap-[var(--space-2)]"><ApplicationStatusCell applicationId={application.id} statusId={application.statusId} statuses={statusOptions} align="end" /><HistoryButton applicationId={application.id} inHistory={Boolean(application.archivedAt)} /></span></li>)}</ul></section>
        <section>
          <SectionLabel as="h2">Activity</SectionLabel>
          <div className="mt-[var(--space-4)] space-y-[var(--space-5)]">
            <NoteComposer candidateId={candidate.id} />
            <ActivityTimeline pinned={timeline.pinned} entries={timeline.entries} />
            {timeline.nextCursor && (
              <a
                href={`/candidates/${candidate.id}?cursor=${encodeURIComponent(timeline.nextCursor)}`}
                className="inline-block text-sm font-semibold text-[var(--foreground)] hover:underline"
              >
                Older activity <IconArrowRight size="1em" className="inline-block align-[-0.125em]" />
              </a>
            )}
          </div>
        </section>
      </div>
    </div>
  </div></main>;
}
