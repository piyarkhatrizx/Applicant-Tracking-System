import { insert, remove, selectAll, selectOne, update, type Row, type Table } from "@/lib/store";
import {
  CALL_DIRECTIONS,
  CALL_OUTCOMES,
  type CallDirection,
  type CallOutcome,
} from "@/lib/activity/types";
import { APPLICATION_SOURCES, type ApplicationSource } from "@/lib/application-source";
import { CAREGIVING_INTERESTS } from "@/lib/caregiver-application";
import { normalizeEmail, normalizePhone } from "@/lib/normalize";
import { COUNTS_AS_VALUES, type StatusCountsAs } from "@/lib/status-counts-as";

/**
 * The domain layer over lib/store.ts. Pages, actions and lib modules read and
 * write through here; nothing above this file ever sees a CSV row.
 *
 * It does two jobs, each in exactly one place:
 *
 * 1. Coercion. Cells arrive as strings and blank is the store's only null, so
 *    `text`, `flag`, `int` and `date` map "" to null and everything else to its
 *    type, and `toCell` maps values back. No other file converts a cell.
 *
 * 2. The Candidate/Application split. applicants.csv holds one row per
 *    APPLICATION, with the person's fields repeated on each. A Candidate is
 *    derived by grouping those rows on normalized email, then phone — never
 *    name — and is identified by the id of that person's first row. A write to
 *    a candidate lands on every row in the group, so the copies never disagree.
 *    Callers get Candidate and Application and never the flattening.
 *
 * Reads return rows in file order. File order is not display order: callers
 * sort.
 */

// ---- Coercion -------------------------------------------------------------

const text = (cell: string) => (cell === "" ? null : cell);
const flag = (cell: string) => (cell === "" ? null : cell === "true");
const int = (cell: string) => (cell === "" ? null : Number(cell));
const date = (cell: string) => (cell === "" ? null : new Date(cell));

/** A value back to a cell. null and undefined become "", the store's only null. */
function toCell(value: string | number | boolean | Date | null | undefined) {
  if (value === null || value === undefined) return "";
  return value instanceof Date ? value.toISOString() : String(value);
}

/**
 * A required cell. Blank or unparseable here is corrupt data, reported by
 * table, row id and column — never by value, which may be personal data.
 */
function must<T>(value: T | null, table: Table, row: Row, column: string): T {
  const invalid =
    value === null ||
    (typeof value === "number" && !Number.isFinite(value)) ||
    (value instanceof Date && Number.isNaN(value.getTime()));
  if (invalid) throw new Error(`${table} row ${row.id}: ${column} is missing or invalid`);
  return value as T;
}

function oneOf<const T extends readonly string[]>(values: T, table: Table, row: Row, column: string): T[number] {
  const cell = row[column];
  if (!(values as readonly string[]).includes(cell)) {
    throw new Error(`${table} row ${row.id}: ${column} is not one of ${values.join(", ")}`);
  }
  return cell as T[number];
}

// ---- Types ----------------------------------------------------------------

export const JOB_STATUSES = ["OPEN", "PAUSED", "CLOSED"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export type Job = {
  id: number;
  code: string;
  title: string;
  location: string | null;
  description: string | null;
  employmentType: string | null;
  status: JobStatus;
  openedAt: Date;
};

export type Status = {
  id: number;
  key: string;
  label: string;
  color: string;
  order: number;
  isTerminal: boolean;
  active: boolean;
  countsAs: StatusCountsAs;
};

export const JOB_FIELD_TYPES = ["TEXT", "YES_NO", "SELECT"] as const;
export type JobFieldType = (typeof JOB_FIELD_TYPES)[number];

/**
 * A recruiter-configured question on one job's apply page. Three reserved
 * keys ("first_name", "email", "phone") mark the built-in identity fields —
 * intake still handles those through the ordinary PersonFields path, so only
 * genuinely custom fields get an application_field_values row. `options`
 * matters only when type is SELECT.
 */
export type JobField = {
  id: number;
  jobId: number;
  key: string;
  label: string;
  type: JobFieldType;
  options: string[];
  required: boolean;
  order: number;
};

export const RESERVED_FIELD_KEYS = ["first_name", "email", "phone"] as const;

export type FieldValue = {
  id: number;
  applicationId: number;
  jobFieldId: number;
  value: string;
};

export type Screening = {
  isAtLeast18: boolean;
  /** null is "Not answered": the question is optional on the form. */
  isCpaCertified: boolean | null;
  patientUsesMedicare: boolean;
  caregivingInterest: (typeof CAREGIVING_INTERESTS)[number];
};

export type Application = {
  id: number;
  candidateId: number;
  jobId: number;
  statusId: number;
  source: ApplicationSource;
  /** Only apply-form submissions answer screening questions. */
  screening: Screening | null;
  appliedAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
};

const PERSON_COLUMNS = {
  firstName: "first_name",
  lastName: "last_name",
  email: "email",
  phone: "phone",
  location: "location",
  currentTitle: "current_title",
  currentEmployer: "current_employer",
  linkedinUrl: "linkedin_url",
} as const;

export type PersonFields = { -readonly [K in keyof typeof PERSON_COLUMNS]: string | null };

export type Candidate = PersonFields & { id: number; createdAt: Date };

export type Note = {
  id: number;
  applicationId: number;
  body: string;
  pinned: boolean;
  createdAt: Date;
};

export type CallLog = {
  id: number;
  applicationId: number;
  direction: CallDirection;
  disposition: CallOutcome;
  durationSeconds: number | null;
  phoneNumber: string;
  notes: string | null;
  summary: string | null;
  startedAt: Date;
  endedAt: Date | null;
};

export type ActivityRecord = {
  id: number;
  applicationId: number;
  type: string;
  /** Parsed detail_json. Validated by safeParseActivity, not here. */
  payload: unknown;
  /** null means a system wrote it. See writeActivity. */
  actor: string | null;
  createdAt: Date;
};

// ---- Row mapping ----------------------------------------------------------

function toJob(row: Row): Job {
  return {
    id: Number(row.id),
    code: must(text(row.code), "jobs", row, "code"),
    title: must(text(row.title), "jobs", row, "title"),
    location: text(row.location),
    description: text(row.description ?? ""),
    employmentType: text(row.employment_type),
    status: oneOf(JOB_STATUSES, "jobs", row, "status"),
    openedAt: must(date(row.opened_at), "jobs", row, "opened_at"),
  };
}

function toStatus(row: Row): Status {
  return {
    id: Number(row.id),
    key: must(text(row.key), "statuses", row, "key"),
    label: must(text(row.label), "statuses", row, "label"),
    color: must(text(row.color), "statuses", row, "color"),
    order: must(int(row.sort_order), "statuses", row, "sort_order"),
    isTerminal: flag(row.is_terminal) === true,
    // In use unless it says otherwise.
    active: flag(row.active) !== false,
    countsAs: oneOf(COUNTS_AS_VALUES, "statuses", row, "counts_as"),
  };
}

/** Exported for tests. */
export function toApplication(row: Row, candidateId: number): Application {
  const isAtLeast18 = flag(row.is_at_least_18);
  return {
    id: Number(row.id),
    candidateId,
    jobId: must(int(row.job_id), "applicants", row, "job_id"),
    statusId: must(int(row.status_id), "applicants", row, "status_id"),
    source: oneOf(APPLICATION_SOURCES, "applicants", row, "source"),
    // The first screening question is required on /apply, so a blank there
    // means the application has no screening block at all.
    screening:
      isAtLeast18 === null
        ? null
        : {
            isAtLeast18,
            isCpaCertified: flag(row.is_cpa_certified),
            patientUsesMedicare: flag(row.patient_uses_medicare) === true,
            caregivingInterest: oneOf(CAREGIVING_INTERESTS, "applicants", row, "caregiving_interest"),
          },
    appliedAt: must(date(row.applied_at), "applicants", row, "applied_at"),
    updatedAt: must(date(row.updated_at), "applicants", row, "updated_at"),
    archivedAt: date(row.archived_at),
  };
}

function toJobField(row: Row): JobField {
  const rawOptions = text(row.options);
  return {
    id: Number(row.id),
    jobId: must(int(row.job_id), "job_fields", row, "job_id"),
    key: must(text(row.key), "job_fields", row, "key"),
    label: must(text(row.label), "job_fields", row, "label"),
    type: oneOf(JOB_FIELD_TYPES, "job_fields", row, "type"),
    options: rawOptions ? rawOptions.split("|") : [],
    required: flag(row.required) === true,
    order: must(int(row.order_index), "job_fields", row, "order_index"),
  };
}

function toFieldValue(row: Row): FieldValue {
  return {
    id: Number(row.id),
    applicationId: must(int(row.application_id), "application_field_values", row, "application_id"),
    jobFieldId: must(int(row.job_field_id), "application_field_values", row, "job_field_id"),
    value: text(row.value) ?? "",
  };
}

function toNote(row: Row): Note {
  return {
    id: Number(row.id),
    applicationId: must(int(row.applicant_id), "notes", row, "applicant_id"),
    body: must(text(row.body), "notes", row, "body"),
    pinned: flag(row.pinned) === true,
    createdAt: must(date(row.created_at), "notes", row, "created_at"),
  };
}

function toCallLog(row: Row): CallLog {
  return {
    id: Number(row.id),
    applicationId: must(int(row.applicant_id), "call_logs", row, "applicant_id"),
    direction: oneOf(CALL_DIRECTIONS, "call_logs", row, "direction"),
    disposition: oneOf(CALL_OUTCOMES, "call_logs", row, "disposition"),
    durationSeconds: int(row.duration_seconds),
    phoneNumber: must(text(row.phone_number), "call_logs", row, "phone_number"),
    notes: text(row.notes),
    summary: text(row.summary),
    startedAt: must(date(row.started_at), "call_logs", row, "started_at"),
    endedAt: date(row.ended_at),
  };
}

function toActivity(row: Row): ActivityRecord {
  let payload: unknown = null;
  try {
    payload = JSON.parse(row.detail_json || "null");
  } catch {
    // Lenient on read: a malformed payload renders as unrecognized rather
    // than taking the whole timeline down.
  }
  return {
    id: Number(row.id),
    applicationId: must(int(row.applicant_id), "activity", row, "applicant_id"),
    type: row.type,
    payload,
    actor: text(row.actor),
    createdAt: must(date(row.created_at), "activity", row, "created_at"),
  };
}

function personCells(person: Partial<PersonFields>) {
  const cells: Record<string, string> = {};
  for (const [field, column] of Object.entries(PERSON_COLUMNS) as Array<[keyof PersonFields, string]>) {
    if (field in person) cells[column] = toCell(person[field]);
  }
  return cells;
}

function screeningCells(screening: Screening | null) {
  return {
    is_at_least_18: toCell(screening?.isAtLeast18),
    is_cpa_certified: toCell(screening?.isCpaCertified),
    patient_uses_medicare: toCell(screening?.patientUsesMedicare),
    caregiving_interest: toCell(screening?.caregivingInterest),
  };
}

function statusCells(status: Partial<Omit<Status, "id">>) {
  const cells: Record<string, string> = {};
  if (status.key !== undefined) cells.key = status.key;
  if (status.label !== undefined) cells.label = status.label;
  if (status.color !== undefined) cells.color = status.color;
  if (status.order !== undefined) cells.sort_order = toCell(status.order);
  if (status.isTerminal !== undefined) cells.is_terminal = toCell(status.isTerminal);
  if (status.active !== undefined) cells.active = toCell(status.active);
  if (status.countsAs !== undefined) cells.counts_as = status.countsAs;
  return cells;
}

// ---- People ---------------------------------------------------------------

/**
 * Application row id to candidate id. Email first, then phone, never name.
 * A row joins the first earlier row it matches; otherwise it starts a new
 * candidate identified by its own id. Exported for tests.
 */
export function groupPeople(rows: Array<{ id: string; email?: string; phone?: string }>) {
  const byEmail = new Map<string, number>();
  const byPhone = new Map<string, number>();
  const candidateOf = new Map<number, number>();

  for (const row of [...rows].sort((a, b) => Number(a.id) - Number(b.id))) {
    const email = normalizeEmail(row.email);
    const phone = normalizePhone(row.phone);
    const id =
      (email ? byEmail.get(email) : undefined) ??
      (phone ? byPhone.get(phone) : undefined) ??
      Number(row.id);
    if (email && !byEmail.has(email)) byEmail.set(email, id);
    if (phone && !byPhone.has(phone)) byPhone.set(phone, id);
    candidateOf.set(Number(row.id), id);
  }
  return candidateOf;
}

function readApplicants() {
  const rows = selectAll("applicants").sort((a, b) => Number(a.id) - Number(b.id));
  return { rows, candidateOf: groupPeople(rows) };
}

// ---- Reads ----------------------------------------------------------------

export function listJobs() {
  return selectAll("jobs").map(toJob);
}

export function findJob(id: number) {
  const row = selectOne("jobs", id);
  return row ? toJob(row) : null;
}

export function findJobByCode(code: string) {
  const row = selectOne("jobs", { code });
  return row ? toJob(row) : null;
}

/** A job's apply-page questions, in the order the recruiter arranged them. */
export function listJobFields(jobId: number): JobField[] {
  return selectAll("job_fields", (row) => Number(row.job_id) === jobId)
    .map(toJobField)
    .sort((a, b) => a.order - b.order || a.id - b.id);
}

export function listFieldValues(applicationId: number): FieldValue[] {
  return selectAll("application_field_values", (row) => Number(row.application_id) === applicationId).map(
    toFieldValue,
  );
}

export function listStatuses() {
  return selectAll("statuses").map(toStatus);
}

export function findStatus(id: number) {
  const row = selectOne("statuses", id);
  return row ? toStatus(row) : null;
}

export function listApplications(): Application[] {
  const { rows, candidateOf } = readApplicants();
  return rows.map((row) => toApplication(row, candidateOf.get(Number(row.id))!));
}

export function findApplication(id: number) {
  return listApplications().find((application) => application.id === id) ?? null;
}

export function listCandidates(): Candidate[] {
  const { rows, candidateOf } = readApplicants();
  const byId = new Map<number, Candidate>();

  for (const row of rows) {
    const id = candidateOf.get(Number(row.id))!;
    const appliedAt = must(date(row.applied_at), "applicants", row, "applied_at");
    const candidate: Candidate = byId.get(id) ?? {
      id,
      createdAt: appliedAt,
      firstName: null,
      lastName: null,
      email: null,
      phone: null,
      location: null,
      currentTitle: null,
      currentEmployer: null,
      linkedinUrl: null,
    };
    // Later non-blank values win. Writes keep a group's rows identical, so
    // this only decides anything for a hand-edited file.
    for (const [field, column] of Object.entries(PERSON_COLUMNS) as Array<[keyof PersonFields, string]>) {
      const value = text(row[column]);
      if (value !== null) candidate[field] = value;
    }
    if (appliedAt < candidate.createdAt) candidate.createdAt = appliedAt;
    byId.set(id, candidate);
  }
  return [...byId.values()];
}

export function findCandidate(id: number) {
  return listCandidates().find((candidate) => candidate.id === id) ?? null;
}

export function listNotes() {
  return selectAll("notes").map(toNote);
}

export function listCallLogs() {
  return selectAll("call_logs").map(toCallLog);
}

export function listActivity() {
  return selectAll("activity").map(toActivity);
}

// ---- Writes ---------------------------------------------------------------
// Activity rows are written by writeActivity in lib/activity/write.ts, which
// validates first. insertActivity exists for it alone.

export function insertJob(input: Omit<Job, "id">) {
  return toJob(
    insert("jobs", {
      code: input.code,
      title: input.title,
      location: toCell(input.location),
      description: toCell(input.description),
      employment_type: toCell(input.employmentType),
      status: input.status,
      opened_at: toCell(input.openedAt),
    }),
  );
}

export function insertJobField(input: Omit<JobField, "id">) {
  return toJobField(
    insert("job_fields", {
      job_id: toCell(input.jobId),
      key: input.key,
      label: input.label,
      type: input.type,
      options: input.options.join("|"),
      required: toCell(input.required),
      order_index: toCell(input.order),
    }),
  );
}

export function insertFieldValue(input: Omit<FieldValue, "id">) {
  return toFieldValue(
    insert("application_field_values", {
      application_id: toCell(input.applicationId),
      job_field_id: toCell(input.jobFieldId),
      value: input.value,
    }),
  );
}

export function insertApplication(input: {
  jobId: number;
  statusId: number;
  source: ApplicationSource;
  screening: Screening | null;
  person: PersonFields;
  appliedAt: Date;
}) {
  const row = insert("applicants", {
    job_id: toCell(input.jobId),
    status_id: toCell(input.statusId),
    source: input.source,
    ...personCells(input.person),
    ...screeningCells(input.screening),
    applied_at: toCell(input.appliedAt),
    updated_at: toCell(input.appliedAt),
  });
  return Number(row.id);
}

export function patchApplication(
  id: number,
  patch: { statusId?: number; screening?: Screening | null; updatedAt?: Date; archivedAt?: Date | null },
) {
  const cells: Record<string, string> = {};
  if (patch.statusId !== undefined) cells.status_id = toCell(patch.statusId);
  if (patch.screening !== undefined) Object.assign(cells, screeningCells(patch.screening));
  if (patch.updatedAt !== undefined) cells.updated_at = toCell(patch.updatedAt);
  if (patch.archivedAt !== undefined) cells.archived_at = toCell(patch.archivedAt);
  return update("applicants", id, cells) !== null;
}

/** A person's fields live on every one of their application rows; all of them change. */
export function patchCandidate(candidateId: number, patch: Partial<PersonFields>) {
  const cells = personCells(patch);
  const { rows, candidateOf } = readApplicants();
  for (const row of rows) {
    if (candidateOf.get(Number(row.id)) === candidateId) update("applicants", row.id, cells);
  }
}

export function insertNote(input: Omit<Note, "id">) {
  return toNote(
    insert("notes", {
      applicant_id: toCell(input.applicationId),
      body: input.body,
      pinned: toCell(input.pinned),
      created_at: toCell(input.createdAt),
    }),
  );
}

export function insertCallLog(input: Omit<CallLog, "id">) {
  return toCallLog(
    insert("call_logs", {
      applicant_id: toCell(input.applicationId),
      direction: input.direction,
      disposition: input.disposition,
      duration_seconds: toCell(input.durationSeconds),
      phone_number: input.phoneNumber,
      notes: toCell(input.notes),
      summary: toCell(input.summary),
      started_at: toCell(input.startedAt),
      ended_at: toCell(input.endedAt),
    }),
  );
}

export function insertActivity(input: Omit<ActivityRecord, "id">) {
  const row = insert("activity", {
    applicant_id: toCell(input.applicationId),
    type: input.type,
    detail_json: JSON.stringify(input.payload),
    actor: toCell(input.actor),
    created_at: toCell(input.createdAt),
  });
  return Number(row.id);
}

export function insertStatus(input: Omit<Status, "id">) {
  return toStatus(insert("statuses", statusCells(input)));
}

export function patchStatus(id: number, patch: Partial<Omit<Status, "id" | "key">>) {
  return update("statuses", id, statusCells(patch)) !== null;
}

export function removeStatus(id: number) {
  return remove("statuses", id);
}

/**
 * Permanently removes an application and every row that points at it: its
 * notes, call logs and activity. The one deliberate exception to the
 * append-only activity log; History is the way to hide without losing anything.
 */
export function deleteApplicationRows(applicationId: number) {
  const id = String(applicationId);
  for (const table of ["notes", "call_logs", "activity"] as const) {
    for (const row of selectAll(table, { applicant_id: id })) remove(table, row.id);
  }
  for (const row of selectAll("application_field_values", { application_id: id })) {
    remove("application_field_values", row.id);
  }
  return remove("applicants", applicationId);
}
