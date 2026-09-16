"use server";

import { revalidatePath } from "next/cache";
import { STATUS_COLOR_TOKENS } from "@/components/korosha/status-pill";
import { DEMO_RECRUITER, writeActivity } from "@/lib/activity/write";
import {
  findStatus,
  insertStatus,
  listApplications,
  listStatuses,
  patchApplication,
  patchStatus,
  removeStatus,
} from "@/lib/data";
import { COUNTS_AS_VALUES, type StatusCountsAs } from "@/lib/status-counts-as";

export type StatusActionResult = { ok: true } | { ok: false; error: string };

function revalidateStatusViews() {
  try {
    revalidatePath("/settings/statuses");
    revalidatePath("/leads");
    revalidatePath("/applicants");
  } catch {
    // No request scope. The write already landed; a stale cache is not a failure.
  }
}

function isValidColor(color: string) {
  return (STATUS_COLOR_TOKENS as readonly string[]).includes(color);
}

function isCountsAs(value: string): value is StatusCountsAs {
  return (COUNTS_AS_VALUES as readonly string[]).includes(value);
}

/** Keys are stable identifiers; labels are free text and may be renamed. */
function toKey(label: string) {
  return label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export async function createStatus(input: {
  label: string;
  color: string;
  countsAs: StatusCountsAs;
  isTerminal: boolean;
}): Promise<StatusActionResult> {
  const label = input.label?.trim();
  if (!label) return { ok: false, error: "A status needs a name." };
  if (label.length > 40) return { ok: false, error: "That name is too long." };
  if (!isValidColor(input.color)) return { ok: false, error: "Pick a color from the palette." };
  if (!isCountsAs(input.countsAs)) return { ok: false, error: "Pick what this status counts as." };

  const key = toKey(label);
  if (!key) return { ok: false, error: "That name cannot be used." };

  const statuses = listStatuses();
  if (statuses.some((status) => status.key === key)) {
    return { ok: false, error: "A status with that name already exists." };
  }

  insertStatus({
    key,
    label,
    color: input.color,
    countsAs: input.countsAs,
    isTerminal: Boolean(input.isTerminal),
    active: true,
    order: Math.max(-1, ...statuses.map((status) => status.order)) + 1,
  });

  revalidateStatusViews();
  return { ok: true };
}

export async function updateStatus(input: {
  id: number;
  label?: string;
  color?: string;
  countsAs?: StatusCountsAs;
  isTerminal?: boolean;
  active?: boolean;
}): Promise<StatusActionResult> {
  if (!findStatus(input.id)) return { ok: false, error: "That status no longer exists." };

  const label = input.label?.trim();
  if (input.label !== undefined) {
    if (!label) return { ok: false, error: "A status needs a name." };
    if (label.length > 40) return { ok: false, error: "That name is too long." };
  }
  if (input.color !== undefined && !isValidColor(input.color)) {
    return { ok: false, error: "Pick a color from the palette." };
  }
  if (input.countsAs !== undefined && !isCountsAs(input.countsAs)) {
    return { ok: false, error: "Pick what this status counts as." };
  }

  // Deactivating a status keeps its applications and history; it is simply no
  // longer offered when moving one. Renaming never rewrites history, because
  // STATUS_CHANGED stores the label it saw at the time alongside the id.
  patchStatus(input.id, {
    label,
    color: input.color,
    countsAs: input.countsAs,
    isTerminal: input.isTerminal,
    active: input.active,
  });

  revalidateStatusViews();
  return { ok: true };
}

/**
 * Deletes a status only when nothing points at it.
 *
 * A status with applications attached is never deleted — losing it would strand
 * those leads with no stage at all. The caller is offered deactivate, or
 * reassign-then-delete, instead.
 */
export async function deleteStatus(input: {
  id: number;
  /** When given, move the attached applications here first. */
  reassignToId?: number;
}): Promise<StatusActionResult> {
  const status = findStatus(input.id);
  if (!status) return { ok: false, error: "That status no longer exists." };

  const attached = listApplications().filter((application) => application.statusId === status.id);

  if (attached.length > 0) {
    if (input.reassignToId === undefined) {
      return {
        ok: false,
        error: `${attached.length} application${attached.length === 1 ? "" : "s"} still use this status. Reassign them or deactivate it instead.`,
      };
    }
    if (input.reassignToId === input.id) {
      return { ok: false, error: "Pick a different status to reassign to." };
    }
    const target = findStatus(input.reassignToId);
    if (!target) return { ok: false, error: "That replacement status does not exist." };

    // Reassignment is a state change per application, so each one gets its own
    // event. The activity log is the reporting source of truth and must not
    // silently gain rows in a status it has no record of them entering.
    for (const application of attached) {
      patchApplication(application.id, { statusId: target.id });
      writeActivity({
        applicationId: application.id,
        type: "STATUS_CHANGED",
        payload: {
          from: status.label,
          to: target.label,
          fromStatusId: String(status.id),
          toStatusId: String(target.id),
          reassigned: true,
        },
        actor: DEMO_RECRUITER,
      });
    }
  }

  removeStatus(status.id);
  revalidateStatusViews();
  return { ok: true };
}

/** Persists a new board order. Ids arrive in the order they should appear. */
export async function reorderStatuses(orderedIds: number[]): Promise<StatusActionResult> {
  if (!orderedIds.length) return { ok: false, error: "Nothing to reorder." };

  const known = new Set(listStatuses().map((status) => status.id));
  if (orderedIds.some((id) => !known.has(id))) {
    return { ok: false, error: "That list is out of date. Reload and try again." };
  }

  orderedIds.forEach((id, index) => patchStatus(id, { order: index }));

  revalidateStatusViews();
  return { ok: true };
}
