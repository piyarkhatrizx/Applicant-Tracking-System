import { safeParseActivity, type ParsedActivity } from "@/lib/activity/types";
import {
  listActivity,
  listApplications,
  listCallLogs,
  listJobs,
  listNotes,
  type CallLog,
} from "@/lib/data";

export const TIMELINE_PAGE_SIZE = 50;

export type TimelineRow = {
  id: number;
  type: string;
  payload: unknown;
  createdAt: Date;
  /** null means a system wrote it. */
  actor: string | null;
  /** A note's text, or a call's summary (its typed notes when it has no summary). */
  body: string | null;
  pinned: boolean;
  call: CallLog | null;
  jobTitle: string | null;
};

export type TimelineEntry = ParsedActivity<TimelineRow>;

export type CandidateTimeline = {
  pinned: TimelineEntry[];
  entries: TimelineEntry[];
  nextCursor: string | null;
};

/**
 * Newest first, id breaking ties. createdAt alone is not unique — seeded
 * history writes several rows in the same minute — and a cursor on a
 * non-unique key would drop or repeat rows at the page boundary.
 */
const newestFirst = (a: Pick<TimelineRow, "createdAt" | "id">, b: Pick<TimelineRow, "createdAt" | "id">) =>
  b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id;

function encodeCursor(row: Pick<TimelineRow, "createdAt" | "id">) {
  return `${row.createdAt.toISOString()}|${row.id}`;
}

function decodeCursor(cursor: string | null | undefined) {
  if (!cursor) return null;
  const [timestamp, id] = cursor.split("|");
  const createdAt = new Date(timestamp ?? "");
  if (!/^[1-9]\d*$/.test(id ?? "") || Number.isNaN(createdAt.getTime())) return null;
  return { createdAt, id: Number(id) };
}

/**
 * Every activity for one candidate, across all of their applications, with the
 * note or call each event points at joined in. Pinned notes are returned
 * separately on the first page so an old pinned note still surfaces at the top.
 */
export function getCandidateTimeline(
  candidateId: number,
  options: { cursor?: string | null } = {},
): CandidateTimeline {
  const jobTitles = new Map(listJobs().map((job) => [job.id, job.title]));
  const jobOf = new Map(
    listApplications()
      .filter((application) => application.candidateId === candidateId)
      .map((application) => [application.id, jobTitles.get(application.jobId) ?? null]),
  );
  const notes = new Map(listNotes().map((note) => [note.id, note]));
  const calls = new Map(listCallLogs().map((call) => [call.id, call]));

  const rows: TimelineRow[] = listActivity()
    .filter((record) => jobOf.has(record.applicationId))
    .map((record) => {
      const ref =
        record.payload && typeof record.payload === "object"
          ? (record.payload as Record<string, unknown>)
          : {};
      const note = record.type === "NOTE_ADDED" ? notes.get(Number(ref.noteId)) : undefined;
      const call = record.type === "CALL_LOGGED" ? (calls.get(Number(ref.callLogId)) ?? null) : null;
      return {
        id: record.id,
        type: record.type,
        payload: record.payload,
        createdAt: record.createdAt,
        actor: record.actor,
        body: note?.body ?? call?.summary ?? call?.notes ?? null,
        pinned: note?.pinned ?? false,
        call,
        jobTitle: jobOf.get(record.applicationId) ?? null,
      };
    })
    .sort(newestFirst);

  const after = decodeCursor(options.cursor);
  const remaining = after ? rows.filter((row) => newestFirst(after, row) > 0) : rows;
  const page = remaining.slice(0, TIMELINE_PAGE_SIZE);

  return {
    pinned: after ? [] : rows.filter((row) => row.pinned).slice(0, 20).map((row) => safeParseActivity(row)),
    entries: page.map((row) => safeParseActivity(row)),
    nextCursor: remaining.length > TIMELINE_PAGE_SIZE ? encodeCursor(page[page.length - 1]) : null,
  };
}

/** Groups entries by calendar day, preserving the newest-first order. */
export function groupByDay(entries: TimelineEntry[]) {
  const groups: Array<{ day: string; entries: TimelineEntry[] }> = [];
  for (const entry of entries) {
    const day = entry.row.createdAt.toISOString().slice(0, 10);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.entries.push(entry);
    else groups.push({ day, entries: [entry] });
  }
  return groups;
}
