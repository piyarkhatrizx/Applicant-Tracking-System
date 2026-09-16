import { listJobs, type Job } from "@/lib/data";

export type ApplyJobResult =
  | { ok: true; job: Job }
  | { ok: false; status: 404 | 409; error: string };

/**
 * The requisition /apply files into when the link names none.
 *
 * The form asks general caregiver questions, so the default is the general Home
 * Health Caregiver role. It is chosen by code on purpose: "whichever opened
 * last" once made a CNA role the default for a caregiver form. If this job is
 * paused or closed, /apply says so rather than quietly filing somewhere else.
 */
export const DEFAULT_APPLY_JOB_CODE = "CARE-001";

/**
 * Which requisition an application files into.
 *
 * `ref` is a job code (CARE-002, any case) or a numeric id; without one it is
 * DEFAULT_APPLY_JOB_CODE. Paused and closed requisitions refuse applications
 * with a message the applicant can read.
 */
export function resolveApplyJob(ref?: string | null): ApplyJobResult {
  const named = ref?.trim();
  const wanted = named || DEFAULT_APPLY_JOB_CODE;

  const byId = /^[1-9]\d{0,8}$/.test(wanted) ? Number(wanted) : null;
  const job = listJobs().find((candidate) => candidate.code.toLowerCase() === wanted.toLowerCase() || candidate.id === byId);

  if (!job) {
    return named
      ? { ok: false, status: 404, error: "That job posting does not exist. Check the link and try again." }
      : { ok: false, status: 409, error: "We are not accepting applications right now. Please check back soon." };
  }
  if (job.status === "PAUSED") {
    return { ok: false, status: 409, error: `${job.title} is paused and is not accepting applications right now.` };
  }
  if (job.status === "CLOSED") {
    return { ok: false, status: 409, error: `${job.title} has closed and is no longer accepting applications.` };
  }
  return { ok: true, job };
}
