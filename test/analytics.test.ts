import { describe, expect, it } from "vitest";
import { computeAnalytics, median, WEEKS } from "@/lib/analytics";
import type { ActivityRecord, Application, CallLog, Status } from "@/lib/data";

const now = new Date("2026-09-14T12:00:00.000Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);

const statuses: Status[] = [
  { id: 1, key: "NEW", label: "New", color: "--status-open", order: 0, isTerminal: false, active: true, countsAs: "OPEN" },
  { id: 2, key: "SCREENING", label: "Screening", color: "--status-active", order: 1, isTerminal: false, active: true, countsAs: "OPEN" },
  { id: 3, key: "HIRED", label: "Hired", color: "--status-accepted", order: 2, isTerminal: true, active: true, countsAs: "ACCEPTED" },
  { id: 4, key: "REJECTED", label: "Rejected", color: "--status-rejected", order: 3, isTerminal: true, active: true, countsAs: "REJECTED" },
];

function application(id: number, statusId: number, appliedDaysAgo: number, archived = false): Application {
  return {
    id,
    candidateId: id,
    jobId: 1,
    statusId,
    source: id % 2 ? "APPLY_FORM" : "EMAIL",
    screening: null,
    appliedAt: daysAgo(appliedDaysAgo),
    updatedAt: daysAgo(0),
    archivedAt: archived ? daysAgo(1) : null,
  };
}

let nextId = 1;
function moved(applicationId: number, from: number, to: number, atDaysAgo: number): ActivityRecord {
  return {
    id: nextId++,
    applicationId,
    type: "STATUS_CHANGED",
    payload: { from: "x", to: "y", fromStatusId: String(from), toStatusId: String(to) },
    actor: "Dana Whitfield",
    createdAt: daysAgo(atDaysAgo),
  };
}

function call(id: number, disposition: CallLog["disposition"], startedDaysAgo: number): CallLog {
  return {
    id,
    applicationId: 1,
    direction: "OUTBOUND",
    disposition,
    durationSeconds: 60,
    phoneNumber: "2165550100",
    notes: null,
    summary: null,
    startedAt: daysAgo(startedDaysAgo),
    endedAt: daysAgo(startedDaysAgo),
  };
}

const applications = [
  application(1, 3, 20, true), // hired after 12 days, then archived: still counts
  application(2, 3, 10), // hired after 4 days
  application(3, 4, 3), // rejected from screening
  application(4, 1, 1), // untouched
  application(5, 2, 2), // sits in screening with no event: still reached it
];

const activity = [
  moved(1, 1, 2, 19),
  moved(1, 2, 3, 8),
  moved(2, 1, 2, 9),
  moved(2, 2, 3, 6),
  moved(3, 1, 2, 2),
  moved(3, 2, 4, 1),
  { id: 99, applicationId: 4, type: "SMOKE_SIGNAL", payload: null, actor: null, createdAt: daysAgo(1) },
];

const calls = [call(1, "CONNECTED", 1), call(2, "NO_ANSWER", 8), call(3, "VOICEMAIL", 100)];

const result = computeAnalytics({ applications, statuses, activity, calls, now });

describe("analytics definitions", () => {
  it("counts every application, archived included", () => {
    expect(result.total).toBe(5);
    expect(result.archived).toBe(1);
    expect(result.hires).toBe(2);
    expect(result.rejectedShare).toBeCloseTo(1 / 5);
  });

  it("builds the funnel from open stages in board order, then accepted as the last stage", () => {
    expect(result.funnel.map((stage) => [stage.label, stage.reached])).toEqual([
      ["New", 5],
      ["Screening", 4],
      ["Hired", 2],
    ]);
    expect(result.funnel[1].ofTotal).toBeCloseTo(0.8);
    expect(result.funnel[2].ofPrevious).toBeCloseTo(0.5);
  });

  it("measures time to hire from applied to the first move into an accepted status", () => {
    expect(result.timeToHire).toEqual({ median: 8, min: 4, max: 12, hires: 2 });
  });

  it("computes connect rate over every logged call", () => {
    expect(result.calls.total).toBe(3);
    expect(result.calls.connectRate).toBeCloseTo(1 / 3);
    expect(result.calls.byDisposition.find((row) => row.disposition === "WRONG_NUMBER")?.count).toBe(0);
  });

  it("buckets weeks back from now, oldest first, and leaves out anything older than the window", () => {
    expect(result.applicationsPerWeek).toHaveLength(WEEKS);
    const newestFirst = [...result.applicationsPerWeek].reverse().map((week) => week.count);
    // Days ago 1, 2, 3 in week 0; 10 in week 1; 20 in week 2.
    expect(newestFirst.slice(0, 3)).toEqual([3, 1, 1]);
    // The call from 100 days ago is outside the 13 weeks.
    expect(result.callsPerWeek.reduce((sum, week) => sum + week.count, 0)).toBe(2);
  });

  it("breaks down status and source across everything", () => {
    expect(result.byStatus.map((row) => [row.status.key, row.count])).toEqual([
      ["NEW", 1],
      ["SCREENING", 1],
      ["HIRED", 2],
      ["REJECTED", 1],
    ]);
    expect(result.bySource.find((row) => row.source === "APPLY_FORM")?.count).toBe(3);
  });

  it("takes the middle of an even count as the mean of the two middle values", () => {
    expect(median([12, 4])).toBe(8);
    expect(median([5, 1, 3])).toBe(3);
  });
});
