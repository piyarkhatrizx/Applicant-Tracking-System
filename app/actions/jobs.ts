"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/activity";
import {
  insertJob,
  insertJobField,
  listJobs,
  JOB_FIELD_TYPES,
  RESERVED_FIELD_KEYS,
  type JobFieldType,
} from "@/lib/data";

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export type JobFieldInput = {
  /** One of RESERVED_FIELD_KEYS for a built-in identity field, or a generated slug for a custom one. */
  key: string;
  label: string;
  type: JobFieldType;
  options: string[];
  required: boolean;
};

/**
 * Validates the apply-page field list a recruiter configured in the "Create
 * new job board" modal. Intake dedupes on email or phone (lib/intake.ts), so
 * at least one of those two reserved fields must survive.
 */
function validateFields(raw: unknown): { ok: true; fields: JobFieldInput[] } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, error: "Add at least one field to the apply page." };
  if (raw.length > 20) return { ok: false, error: "That's too many fields for one apply page." };

  const seenKeys = new Set<string>();
  const fields: JobFieldInput[] = [];
  for (const entry of raw) {
    const key = text((entry as { key?: unknown })?.key);
    const label = text((entry as { label?: unknown })?.label);
    const type = (entry as { type?: unknown })?.type;
    const required = Boolean((entry as { required?: unknown })?.required);
    const optionsRaw = (entry as { options?: unknown })?.options;
    const options = Array.isArray(optionsRaw) ? optionsRaw.map((o) => text(o)).filter(Boolean) : [];

    if (!key || seenKeys.has(key)) return { ok: false, error: "Every field needs a unique key." };
    if (!label) return { ok: false, error: "Every field needs a label." };
    if (label.length > 80) return { ok: false, error: "A field label is too long." };
    if (typeof type !== "string" || !JOB_FIELD_TYPES.includes(type as JobFieldType)) {
      return { ok: false, error: "Pick a valid field type." };
    }
    if (type === "SELECT" && options.length < 2) {
      return { ok: false, error: `"${label}" needs at least two options.` };
    }
    if ((RESERVED_FIELD_KEYS as readonly string[]).includes(key) && (type !== "TEXT" || options.length > 0)) {
      return { ok: false, error: "Built-in fields can't be reconfigured." };
    }
    seenKeys.add(key);
    fields.push({ key, label, type: type as JobFieldType, options, required });
  }

  const dedupeKeys: readonly string[] = RESERVED_FIELD_KEYS.filter((key) => key !== "first_name");
  const hasDedupeField = fields.some((field) => dedupeKeys.includes(field.key));
  if (!hasDedupeField) {
    return { ok: false, error: "Keep email or phone on the apply page — applicants are matched on one of them." };
  }
  return { ok: true, fields };
}

/**
 * Creates a job posting and its apply-page field configuration together.
 * Codes continue the existing series, so CARE-006 is followed by CARE-007;
 * that code is also the job's apply-page slug (/apply/CARE-007).
 */
export async function createJobPosting(input: {
  title: string;
  location: string;
  description?: string;
  status: "OPEN" | "CLOSED";
  fields: JobFieldInput[];
}): Promise<ActionResult<{ id: number; code: string; title: string }>> {
  // Server action arguments are untrusted, whatever the TypeScript types say.
  const title = text(input?.title);
  const location = text(input?.location);
  const description = text(input?.description);
  if (!title) return { ok: false, error: "A job posting needs a title." };
  if (title.length > 80) return { ok: false, error: "That title is too long." };
  if (!location) return { ok: false, error: "Add a location." };
  if (location.length > 80) return { ok: false, error: "That location is too long." };
  if (description.length > 2000) return { ok: false, error: "That description is too long." };
  if (input?.status !== "OPEN" && input?.status !== "CLOSED") return { ok: false, error: "Pick open or closed." };

  const validated = validateFields(input?.fields);
  if (!validated.ok) return { ok: false, error: validated.error };

  const highest = listJobs().reduce((max, job) => Math.max(max, Number(/^CARE-(\d+)$/.exec(job.code)?.[1] ?? 0)), 0);
  const job = insertJob({
    code: `CARE-${String(highest + 1).padStart(3, "0")}`,
    title,
    location,
    description: description || null,
    employmentType: null,
    status: input.status,
    openedAt: new Date(),
  });

  validated.fields.forEach((field, index) => {
    insertJobField({ jobId: job.id, order: index, ...field });
  });

  try {
    revalidatePath("/applicants");
    revalidatePath("/analytics");
  } catch {
    // No request scope. The write already landed; a stale cache is not a failure.
  }
  return { ok: true, data: { id: job.id, code: job.code, title: job.title } };
}
