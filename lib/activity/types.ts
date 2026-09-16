import { z } from "zod";
import { APPLICATION_SOURCES } from "@/lib/application-source";

/**
 * The activity contract, and nothing else.
 *
 * This module is pure — it never reaches the store — so client components can
 * import its constants. Rows are written only by writeActivity in
 * lib/activity/write.ts, which validates against the schema below first.
 *
 * `type` is a plain string column, so a row written by an older or newer build
 * still loads: strict on write, lenient on read via safeParseActivity.
 */
export const ACTIVITY_TYPES = [
  "APPLICATION_CREATED",
  "REAPPLIED",
  "STATUS_CHANGED",
  "NOTE_ADDED",
  "CALL_LOGGED",
  "ARCHIVED",
  "RESTORED",
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const CALL_DIRECTIONS = ["OUTBOUND", "INBOUND"] as const;
export type CallDirection = (typeof CALL_DIRECTIONS)[number];

export const CALL_OUTCOMES = [
  "CONNECTED",
  "VOICEMAIL",
  "NO_ANSWER",
  "WRONG_NUMBER",
  "CALLBACK_REQUESTED",
] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number];

const sourceEnum = z.enum(APPLICATION_SOURCES);

/** A row id as a payload stores it: the same decimal string the CSV holds. */
const rowId = z.string().regex(/^[1-9]\d*$/);

export const activityPayloadSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("APPLICATION_CREATED"), source: sourceEnum }),
  z.object({ type: z.literal("REAPPLIED"), source: sourceEnum }),
  /**
   * Stores BOTH ids and label snapshots.
   *
   * The ids are the truth: analytics joins on them, and renaming a status must
   * not rewrite history. The labels are what the status was CALLED at the time,
   * so the timeline still reads correctly after a rename or a delete.
   * `reassigned` marks moves caused by deleting a status rather than by a
   * recruiter choosing a stage.
   */
  z.object({
    type: z.literal("STATUS_CHANGED"),
    from: z.string(),
    to: z.string(),
    fromStatusId: rowId,
    toStatusId: rowId,
    reassigned: z.literal(true).optional(),
  }),
  // The note's text lives in notes.csv and the call in call_logs.csv. The
  // event points at its row, so no fact is half in one file and half in another.
  z.object({ type: z.literal("NOTE_ADDED"), noteId: rowId }),
  z.object({ type: z.literal("CALL_LOGGED"), callLogId: rowId }),
  z.object({ type: z.literal("ARCHIVED") }),
  z.object({ type: z.literal("RESTORED") }),
]);

export type ActivityPayload = z.infer<typeof activityPayloadSchema>;
export type PayloadFor<T extends ActivityType> = Extract<ActivityPayload, { type: T }>;

/** The payload minus its discriminant, which is what callers actually pass. */
export type PayloadBody<T extends ActivityType> = Omit<PayloadFor<T>, "type">;

export type ActivityRow = { type: string; payload: unknown };

export type ParsedActivity<R extends ActivityRow = ActivityRow> =
  | { known: true; row: R; type: ActivityType; payload: ActivityPayload }
  | { known: false; row: R; type: string; reason: "unknown-type" | "unknown-shape" };

/**
 * Strict on write, lenient on read.
 *
 * A row written by another version of the app, or edited by hand, must render
 * rather than crash the timeline. Callers switch on `known`.
 */
export function safeParseActivity<R extends ActivityRow>(row: R): ParsedActivity<R> {
  if (!(ACTIVITY_TYPES as readonly string[]).includes(row.type)) {
    return { known: false, row, type: row.type, reason: "unknown-type" };
  }

  const candidate =
    row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
      ? { type: row.type, ...(row.payload as Record<string, unknown>) }
      : { type: row.type };

  const result = activityPayloadSchema.safeParse(candidate);
  if (!result.success) {
    return { known: false, row, type: row.type, reason: "unknown-shape" };
  }

  return { known: true, row, type: row.type as ActivityType, payload: result.data };
}
