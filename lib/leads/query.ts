import {
  listActivity,
  listApplications,
  listCandidates,
  listJobs,
  listStatuses,
  type Application,
  type Candidate,
  type Job,
  type Status,
} from "@/lib/data";
import type { ParsedListParams, SortKey } from "@/lib/list-params";

/**
 * The inbox query.
 *
 * A "lead" is an Application. Candidate stays the person behind it, which is
 * why `otherApplicationCount` exists: the row must warn that this person is
 * already in the pipeline, since calling the same lead twice is the failure
 * this product is built to avoid.
 *
 * Filtering, searching, sorting and paging all happen here, over the whole
 * table, and never in a component. Each request reads the files once.
 */

export type Lead = {
  application: Application;
  candidate: Candidate;
  status: Status;
  job: Job | null;
  called: boolean;
  otherApplicationCount: number;
};

export type LeadFilters = Pick<ParsedListParams<"leads">, "source" | "status" | "job" | "uncalled" | "q"> & {
  /** true lists only archived applications. Otherwise archived ones are hidden. */
  archived?: boolean;
};

type Matchable = {
  application: Pick<Application, "source" | "jobId" | "archivedAt">;
  candidate: Pick<Candidate, "firstName" | "lastName" | "email" | "phone">;
  status: Pick<Status, "key">;
  called: boolean;
};

/** Case-insensitive partial match on full name, email or phone. */
export function matchesSearch(candidate: Matchable["candidate"], query: string | null) {
  if (!query) return true;
  const needle = query.toLowerCase();
  const name = [candidate.firstName, candidate.lastName].filter(Boolean).join(" ").toLowerCase();
  if (name.includes(needle) || (candidate.email ?? "").toLowerCase().includes(needle)) return true;
  // Phones are stored as digits, so "(216) 555-01" searches as "21655501". At
  // least three digits, so a stray "1" in a name search does not match everyone.
  const digits = query.replace(/\D/g, "");
  return digits.length >= 3 && (candidate.phone ?? "").includes(digits);
}

export function leadMatches(lead: Matchable, filters: LeadFilters) {
  return (
    Boolean(lead.application.archivedAt) === Boolean(filters.archived) &&
    (!filters.source || lead.application.source === filters.source) &&
    (!filters.job || lead.application.jobId === filters.job) &&
    (!filters.status || lead.status.key === filters.status) &&
    // Uncalled is derived from the activity log, never from a column on the
    // application. Two sources of truth for the same fact would drift.
    (!filters.uncalled || !lead.called) &&
    matchesSearch(lead.candidate, filters.q)
  );
}

/** Every application joined to its person, status, job and call state. Unfiltered. */
export function loadLeads(): Lead[] {
  const statuses = new Map(listStatuses().map((status) => [status.id, status]));
  const candidates = new Map(listCandidates().map((candidate) => [candidate.id, candidate]));
  const jobs = new Map(listJobs().map((job) => [job.id, job]));
  const called = new Set(
    listActivity()
      .filter((record) => record.type === "CALL_LOGGED")
      .map((record) => record.applicationId),
  );
  const applications = listApplications();

  const perCandidate = new Map<number, number>();
  for (const application of applications) {
    perCandidate.set(application.candidateId, (perCandidate.get(application.candidateId) ?? 0) + 1);
  }

  return applications.map((application) => ({
    application,
    candidate: candidates.get(application.candidateId)!,
    status: statuses.get(application.statusId)!,
    job: jobs.get(application.jobId) ?? null,
    called: called.has(application.id),
    otherApplicationCount: perCandidate.get(application.candidateId)! - 1,
  }));
}

const SORTERS: { [K in SortKey<"leads">]: (a: Lead, b: Lead) => number } = {
  appliedAt: (a, b) => a.application.appliedAt.getTime() - b.application.appliedAt.getTime(),
  status: (a, b) => a.status.order - b.status.order,
  source: (a, b) => a.application.source.localeCompare(b.application.source),
  name: (a, b) =>
    (a.candidate.lastName ?? "").localeCompare(b.candidate.lastName ?? "") ||
    (a.candidate.firstName ?? "").localeCompare(b.candidate.firstName ?? ""),
};

export function getLeadInbox(params: ParsedListParams<"leads">) {
  const leads = loadLeads();

  const matching = leads.filter((lead) => leadMatches(lead, params));
  const direction = params.dir === "asc" ? 1 : -1;
  const compare = SORTERS[params.sort];
  // The newest id breaks ties, so equal keys never reshuffle between requests.
  matching.sort((a, b) => direction * compare(a, b) || b.application.id - a.application.id);

  // Each count ignores its own filter, so the number beside a chip is what
  // clicking it would actually show.
  const withoutSource = leads.filter((lead) => leadMatches(lead, { ...params, source: null }));
  const bySource = new Map<string, number>();
  for (const lead of withoutSource) {
    bySource.set(lead.application.source, (bySource.get(lead.application.source) ?? 0) + 1);
  }

  return {
    rows: matching.slice(params.skip, params.skip + params.take),
    matching: matching.length,
    counts: {
      bySource,
      total: withoutSource.length,
      uncalled: leads.filter((lead) => leadMatches(lead, { ...params, uncalled: true })).length,
    },
  };
}

/** Archived applications, most recently archived first. */
export function getArchive() {
  return loadLeads()
    .filter((lead) => lead.application.archivedAt)
    .sort(
      (a, b) =>
        b.application.archivedAt!.getTime() - a.application.archivedAt!.getTime() ||
        b.application.id - a.application.id,
    );
}

/** The Applicants list: every application not in History, newest applied first, optionally for one job posting. */
export function getApplicants(options: { jobId?: number | null; statusId?: number | null } = {}) {
  return loadLeads()
    .filter(
      (lead) =>
        !lead.application.archivedAt &&
        (!options.jobId || lead.application.jobId === options.jobId) &&
        (!options.statusId || lead.status.id === options.statusId),
    )
    .sort(
      (a, b) =>
        b.application.appliedAt.getTime() - a.application.appliedAt.getTime() || b.application.id - a.application.id,
    );
}

/** Compact relative age. The fastest-reading value on the row. */
export function sinceLabel(date: Date, now = Date.now()) {
  // Floor, not round: a lead that arrived 30 seconds ago reads "now" rather
  // than claiming a minute has already gone by.
  const minutes = Math.max(0, Math.floor((now - date.getTime()) / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}
