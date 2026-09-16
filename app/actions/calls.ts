"use server";

import { revalidatePath } from "next/cache";
import { moveApplicationStatus, type ActionResult } from "@/app/actions/activity";
import { CALL_OUTCOMES, type CallOutcome } from "@/lib/activity/types";
import { DEMO_RECRUITER, writeActivity } from "@/lib/activity/write";
import { getActiveStatuses } from "@/lib/application-status";
import { callSummary } from "@/lib/calls/summary";
import {
  findApplication,
  findCandidate,
  findStatus,
  insertCallLog,
  listApplications,
  listCallLogs,
  listJobs,
} from "@/lib/data";
import { normalizePhone } from "@/lib/normalize";

export type PriorCall = {
  id: number;
  /** ISO string, so it crosses to the client unchanged. */
  startedAt: string;
  disposition: CallOutcome;
  durationSeconds: number | null;
  notes: string | null;
  jobTitle: string | null;
};

export type CallContext = {
  applicationId: number;
  name: string;
  phone: string | null;
  jobTitle: string | null;
  statusId: number;
  /** Active stages in board order, for moving the application inline. */
  statuses: Array<{ id: number; label: string; color: string; order: number; isTerminal: boolean }>;
  /** Every earlier call to this person, across all their applications, newest first. */
  priorCalls: PriorCall[];
};

export type CallResult = {
  callLogId: number;
  applicationId: number;
  disposition: CallOutcome;
  durationSeconds: number;
  summary: string;
  statusChange: { from: string; to: string } | null;
  /** Set when the call was logged but the requested stage change was refused. */
  statusError: string | null;
};

function revalidateCallViews(candidateId: number) {
  try {
    revalidatePath(`/candidates/${candidateId}`);
    revalidatePath("/leads");
    revalidatePath("/applicants");
    revalidatePath("/analytics");
  } catch {
    // No request scope. The write already landed; a stale cache is not a failure.
  }
}

const fullName = (person: { firstName: string | null; lastName: string | null }) =>
  [person.firstName, person.lastName].filter(Boolean).join(" ") || "Unnamed candidate";

/** Everything the call modal shows, so it needs nothing from the page that opened it. */
export async function getCallContext(applicationId: number): Promise<ActionResult<CallContext>> {
  const application = findApplication(applicationId);
  if (!application) return { ok: false, error: "That application no longer exists." };
  const candidate = findCandidate(application.candidateId);
  if (!candidate) return { ok: false, error: "That candidate no longer exists." };

  const jobTitle = new Map(listJobs().map((job) => [job.id, job.title]));
  const jobOf = new Map(
    listApplications()
      .filter((row) => row.candidateId === candidate.id)
      .map((row) => [row.id, jobTitle.get(row.jobId) ?? null]),
  );

  const priorCalls = listCallLogs()
    .filter((call) => jobOf.has(call.applicationId))
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime() || b.id - a.id)
    .map((call) => ({
      id: call.id,
      startedAt: call.startedAt.toISOString(),
      disposition: call.disposition,
      durationSeconds: call.durationSeconds,
      notes: call.notes,
      jobTitle: jobOf.get(call.applicationId) ?? null,
    }));

  return {
    ok: true,
    data: {
      applicationId: application.id,
      name: fullName(candidate),
      phone: candidate.phone,
      jobTitle: jobTitle.get(application.jobId) ?? null,
      statusId: application.statusId,
      statuses: getActiveStatuses().map(({ id, label, color, order, isTerminal }) => ({ id, label, color, order, isTerminal })),
      priorCalls,
    },
  };
}

/**
 * Logs a finished simulated call: the call_logs row with its summary, the
 * CALL_LOGGED event, and optionally a stage change. The call is logged whatever
 * happens to the stage change; a refused change comes back as statusError,
 * never as a failed call.
 */
export async function completeSimulatedCall(input: {
  applicationId: number;
  disposition: CallOutcome;
  durationSeconds: number;
  notes?: string | null;
  moveToStatusId?: number | null;
}): Promise<ActionResult<CallResult>> {
  // Server action arguments are untrusted, whatever the TypeScript types say.
  if (!CALL_OUTCOMES.includes(input.disposition)) return { ok: false, error: "Pick how the call went." };
  const durationSeconds = input.durationSeconds;
  if (!Number.isInteger(durationSeconds) || durationSeconds < 0 || durationSeconds > 4 * 3600) {
    return { ok: false, error: "That call duration is not valid." };
  }
  if (input.disposition === "CONNECTED" && durationSeconds < 1) {
    return { ok: false, error: "A reached call needs a duration longer than zero." };
  }
  const notes = typeof input.notes === "string" ? input.notes.trim() : "";
  if (notes.length > 2000) return { ok: false, error: "Those notes are too long." };

  const application = findApplication(input.applicationId);
  if (!application) return { ok: false, error: "That application no longer exists." };
  const candidate = findCandidate(application.candidateId);
  if (!candidate) return { ok: false, error: "That candidate no longer exists." };
  const phoneNumber = normalizePhone(candidate.phone);
  if (!phoneNumber) return { ok: false, error: "There is no dialable phone number on file." };

  const endedAt = new Date();
  const startedAt = new Date(endedAt.getTime() - durationSeconds * 1000);
  const summary = callSummary({
    name: fullName(candidate),
    phoneNumber,
    direction: "OUTBOUND",
    disposition: input.disposition,
    durationSeconds,
    notes: notes || null,
  });

  const call = insertCallLog({
    applicationId: application.id,
    direction: "OUTBOUND",
    disposition: input.disposition,
    durationSeconds,
    phoneNumber,
    notes: notes || null,
    summary,
    startedAt,
    endedAt,
  });
  writeActivity({
    applicationId: application.id,
    type: "CALL_LOGGED",
    payload: { callLogId: String(call.id) },
    actor: DEMO_RECRUITER,
    createdAt: startedAt,
  });

  let statusChange: CallResult["statusChange"] = null;
  let statusError: string | null = null;
  const moveTo = typeof input.moveToStatusId === "number" ? input.moveToStatusId : null;
  if (moveTo !== null && moveTo !== application.statusId) {
    const from = findStatus(application.statusId);
    const moved = await moveApplicationStatus(application.id, moveTo);
    if (moved.ok) statusChange = { from: from?.label ?? "Unknown", to: findStatus(moveTo)?.label ?? "Unknown" };
    else statusError = moved.error;
  }

  revalidateCallViews(candidate.id);
  return {
    ok: true,
    data: {
      callLogId: call.id,
      applicationId: application.id,
      disposition: input.disposition,
      durationSeconds,
      summary,
      statusChange,
      statusError,
    },
  };
}
