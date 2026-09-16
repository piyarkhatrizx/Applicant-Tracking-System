"use server";

import { revalidatePath } from "next/cache";
import { DEMO_RECRUITER, writeActivity } from "@/lib/activity/write";
import {
  deleteApplicationRows,
  findApplication,
  findStatus,
  insertNote,
  listApplications,
  patchApplication,
} from "@/lib/data";

export type ActionResult<T = void> =
  | ({ ok: true } & (T extends void ? Record<string, never> : { data: T }))
  | { ok: false; error: string };

/** StatusSelect depends on this exact shape; do not widen it casually. */
export type StatusChangeResult = { ok: true } | { ok: false; error: string };

/**
 * The write has already landed by the time this runs, and revalidatePath
 * throws outside a request context. A stale cache must never be reported as a
 * failed mutation — that invites a retry of something that already happened.
 */
function revalidateCandidate(candidateId: number) {
  try {
    revalidatePath(`/candidates/${candidateId}`);
    revalidatePath("/leads");
    revalidatePath("/history");
    revalidatePath("/analytics");
    revalidatePath("/applicants");
  } catch {
    // No request scope (a script or a test). Nothing to revalidate.
  }
}

/** The application a candidate-level action attaches to: the one named, or their latest. */
function resolveApplication(candidateId: number, applicationId?: number | null) {
  const theirs = listApplications().filter((application) => application.candidateId === candidateId);
  if (applicationId !== null && applicationId !== undefined) {
    return theirs.find((application) => application.id === applicationId) ?? null;
  }
  return theirs.sort((a, b) => b.appliedAt.getTime() - a.appliedAt.getTime() || b.id - a.id)[0] ?? null;
}

export async function addNote(input: {
  candidateId: number;
  applicationId?: number | null;
  body: string;
}): Promise<ActionResult> {
  const body = input.body?.trim();
  if (!body) return { ok: false, error: "A note needs some text." };
  if (body.length > 10_000) return { ok: false, error: "That note is too long." };

  const application = resolveApplication(input.candidateId, input.applicationId);
  if (!application) return { ok: false, error: "That candidate no longer exists." };

  const createdAt = new Date();
  const note = insertNote({ applicationId: application.id, body, pinned: false, createdAt });
  writeActivity({
    applicationId: application.id,
    type: "NOTE_ADDED",
    payload: { noteId: String(note.id) },
    actor: DEMO_RECRUITER,
    createdAt,
  });

  revalidateCandidate(input.candidateId);
  return { ok: true } as ActionResult;
}

/**
 * Hides an application from the working views. Nothing is deleted: it stays in
 * analytics, keeps its history, and can be restored from /archive.
 */
export async function archiveApplication(applicationId: number): Promise<StatusChangeResult> {
  const application = findApplication(applicationId);
  if (!application) return { ok: false, error: "That application no longer exists." };
  if (application.archivedAt) return { ok: false, error: "That application is already in History." };

  const archivedAt = new Date();
  patchApplication(application.id, { archivedAt });
  writeActivity({ applicationId: application.id, type: "ARCHIVED", payload: {}, actor: DEMO_RECRUITER, createdAt: archivedAt });

  revalidateCandidate(application.candidateId);
  return { ok: true };
}

export async function restoreApplication(applicationId: number): Promise<StatusChangeResult> {
  const application = findApplication(applicationId);
  if (!application) return { ok: false, error: "That application no longer exists." };
  if (!application.archivedAt) return { ok: false, error: "That application is not in History." };

  patchApplication(application.id, { archivedAt: null });
  writeActivity({ applicationId: application.id, type: "RESTORED", payload: {}, actor: DEMO_RECRUITER });

  revalidateCandidate(application.candidateId);
  return { ok: true };
}

/**
 * Permanently deletes an application with its notes, calls and activity. It
 * leaves analytics and cannot be undone; the UI confirms first and offers
 * History as the reversible alternative.
 */
export async function deleteApplication(applicationId: number): Promise<StatusChangeResult> {
  const application = findApplication(applicationId);
  if (!application) return { ok: false, error: "That application no longer exists." };

  deleteApplicationRows(application.id);

  revalidateCandidate(application.candidateId);
  return { ok: true };
}

/**
 * Moves one Application between pipeline stages. StatusSelect renders
 * `{ ok: false, error }` itself rather than requiring callers to throw.
 */
export async function moveApplicationStatus(
  applicationId: number,
  nextStatusId: number,
): Promise<StatusChangeResult> {
  const application = findApplication(applicationId);
  const nextStatus = findStatus(nextStatusId);

  if (!application) return { ok: false, error: "That application no longer exists." };
  if (!nextStatus) return { ok: false, error: "That is not a valid stage." };
  if (!nextStatus.active) return { ok: false, error: "That stage is no longer in use." };
  if (application.statusId === nextStatus.id) {
    return { ok: false, error: "That application is already at this stage." };
  }

  const current = findStatus(application.statusId);

  // Two files, no transaction: see the ponytail note in lib/store.ts. Both
  // writes are synchronous, so nothing else in this process runs between them.
  patchApplication(application.id, { statusId: nextStatus.id });
  writeActivity({
    applicationId: application.id,
    type: "STATUS_CHANGED",
    // Ids are the truth; labels are a snapshot so history survives a rename.
    payload: {
      from: current?.label ?? "Unknown",
      to: nextStatus.label,
      fromStatusId: String(application.statusId),
      toStatusId: String(nextStatus.id),
    },
    actor: DEMO_RECRUITER,
  });

  revalidateCandidate(application.candidateId);
  return { ok: true };
}
