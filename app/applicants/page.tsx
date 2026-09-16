import { ApplicantList, type ApplicantRowData } from "@/components/applicants/applicant-list";
import { JobFilter } from "@/components/applicants/job-filter";
import { StatusFilter } from "@/components/applicants/status-filter";
import { CreateJobPosting } from "@/components/job-postings/create-job-posting";
import { PageHeader } from "@/components/ui/page-header";
import { sourceLabel } from "@/lib/application-source";
import { getActiveStatuses } from "@/lib/application-status";
import { listJobs } from "@/lib/data";
import { getApplicants, sinceLabel, type Lead } from "@/lib/leads/query";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Applicants | Korosha",
  description: "Every active applicant, newest applied first.",
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const idParam = (value: string | undefined) => (value && /^[1-9]\d{0,8}$/.test(value) ? Number(value) : null);

const toRow = ({ application, candidate }: Lead, now: number): ApplicantRowData => {
  const since = sinceLabel(application.appliedAt, now);
  return {
    applicationId: application.id,
    candidateId: candidate.id,
    name: [candidate.firstName, candidate.lastName].filter(Boolean).join(" ") || "Unnamed applicant",
    phone: candidate.phone,
    source: sourceLabel[application.source],
    statusId: application.statusId,
    applied: since === "now" ? "just now" : `${since} ago`,
  };
};

export default async function ApplicantsPage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string | string[]; status?: string | string[] }>;
}) {
  const query = await searchParams;
  const jobs = listJobs().sort((a, b) => a.title.localeCompare(b.title) || a.code.localeCompare(b.code));
  const jobId = idParam(first(query.job));
  const selectedJob = jobId ? (jobs.find((job) => job.id === jobId) ?? null) : null;

  const statuses = getActiveStatuses().map((status) => ({
    id: status.id,
    label: status.label,
    color: status.color,
    isTerminal: status.isTerminal,
  }));
  const statusId = idParam(first(query.status));
  const selectedStatus = statusId ? (statuses.find((status) => status.id === statusId) ?? null) : null;

  const now = Date.now();
  // Job-scoped only, independent of the status filter, so the widgets on the
  // right always describe the whole job (or the whole desk), not the list a
  // status filter narrowed it to.
  const forJob = getApplicants({ jobId: selectedJob?.id ?? null }).map((lead) => toRow(lead, now));
  const applicants: ApplicantRowData[] = selectedStatus
    ? forJob.filter((applicant) => applicant.statusId === selectedStatus.id)
    : forJob;

  const firstStatus = statuses[0] ?? null;
  const inFirstStatus = firstStatus ? forJob.filter((applicant) => applicant.statusId === firstStatus.id).length : 0;
  const openJobs = jobs.filter((job) => job.status === "OPEN").length;

  return (
    <main className="k-shell">
      <PageHeader
        title="Applicants"
        subtitle={`${applicants.length} applicant${applicants.length === 1 ? "" : "s"}${selectedJob ? ` for ${selectedJob.title}` : ""}${selectedStatus ? `, ${selectedStatus.label}` : ""}, newest applied first`}
        actions={<CreateJobPosting jobCount={jobs.length} />}
      />
      <div className="flex flex-wrap items-center gap-[var(--space-3)] rounded-xl bg-[var(--surface-sunken)] px-[var(--space-3)] py-[var(--space-2)]">
        <JobFilter
          jobs={jobs.map(({ id, title, code }) => ({ id, title, code }))}
          selectedId={selectedJob?.id ?? null}
          statusId={selectedStatus?.id ?? null}
        />
        <span aria-hidden="true" className="h-6 w-px bg-[var(--line-strong)]" />
        <StatusFilter statuses={statuses} selectedId={selectedStatus?.id ?? null} jobId={selectedJob?.id ?? null} />
      </div>

      <div className="mt-[var(--space-6)] rounded-lg bg-[var(--surface)] p-[var(--space-2)] shadow-[var(--shadow-elevated)]">
        <div className="grid grid-cols-1 gap-[var(--space-6)] lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0 rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-[var(--space-4)] shadow-[var(--shadow-card)]">
            <ApplicantList applicants={applicants} statuses={statuses} />
          </div>

          <div className="flex flex-col gap-[var(--space-4)]">
            <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-[var(--space-4)] shadow-[var(--shadow-card)]">
              <p className="text-2xs font-medium uppercase tracking-wide text-[var(--ink-faint)]">Open postings</p>
              <p className="mt-[var(--space-1)] text-2xl font-semibold text-[var(--foreground)]">{openJobs}</p>
            </div>
            {firstStatus && (
              <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-[var(--space-4)] shadow-[var(--shadow-card)]">
                <p className="text-2xs font-medium uppercase tracking-wide text-[var(--ink-faint)]">{firstStatus.label}</p>
                <p className="mt-[var(--space-1)] text-2xl font-semibold text-[var(--foreground)]">{inFirstStatus}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
