import { CALL_OUTCOMES, safeParseActivity } from "@/lib/activity/types";
import { APPLICATION_SOURCES } from "@/lib/application-source";
import { getStatuses } from "@/lib/application-status";
import {
  listActivity,
  listApplications,
  listCallLogs,
  type ActivityRecord,
  type Application,
  type CallLog,
  type Status,
} from "@/lib/data";

/**
 * Every analytics number, computed on request from the CSVs. Nothing is cached,
 * precomputed or copied from seed output.
 *
 * The definitions, which `python3 scripts/seed.py --report` computes the same
 * way from data/ as an independent check:
 *   - Every application counts, archived or not (see CLAUDE.md).
 *   - Rejected overall: current status counts as REJECTED, over all applications.
 *   - Funnel stages: open, non-terminal statuses in board order, then every
 *     status that counts as ACCEPTED as one final stage.
 *   - A stage is reached by a STATUS_CHANGED event into it, or by sitting in it
 *     now. Every application has reached the first stage.
 *   - Time to hire: applied to the first move into an ACCEPTED status, in days.
 *   - Connect rate: connected calls over all logged calls.
 *   - Weeks: week 0 is the seven days ending now; 13 weeks cover the 90-day window.
 */

export const WEEKS = 13;
const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

export type AnalyticsInput = {
  applications: Application[];
  statuses: Status[];
  activity: ActivityRecord[];
  calls: CallLog[];
  now: Date;
};

export function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Pure, so the definitions are testable without files. `statuses` must be in board order. */
export function computeAnalytics({ applications, statuses, activity, calls, now }: AnalyticsInput) {
  const total = applications.length;
  const statusById = new Map(statuses.map((status) => [status.id, status]));
  const countsAs = (application: Application) => statusById.get(application.statusId)?.countsAs;

  const weekly = (dates: Date[]) => {
    const counts = Array.from({ length: WEEKS }, () => 0);
    for (const date of dates) {
      const week = Math.floor((now.getTime() - date.getTime()) / WEEK_MS);
      if (week >= 0 && week < WEEKS) counts[week] += 1;
    }
    // Oldest first, for a left-to-right chart.
    return counts
      .map((count, week) => ({ weekStart: new Date(now.getTime() - (week + 1) * WEEK_MS), count }))
      .reverse();
  };

  // Walk status changes in time order: who entered each status, and when each
  // application first moved into an accepted one.
  const entered = new Map<number, Set<number>>();
  const firstAccepted = new Map<number, Date>();
  const changes = [...activity].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id);
  for (const record of changes) {
    const parsed = safeParseActivity(record);
    if (!parsed.known || parsed.payload.type !== "STATUS_CHANGED") continue;
    const toId = Number(parsed.payload.toStatusId);
    if (!entered.has(toId)) entered.set(toId, new Set());
    entered.get(toId)!.add(record.applicationId);
    if (statusById.get(toId)?.countsAs === "ACCEPTED" && !firstAccepted.has(record.applicationId)) {
      firstAccepted.set(record.applicationId, record.createdAt);
    }
  }

  const accepted = statuses.filter((status) => status.countsAs === "ACCEPTED");
  const stages = [
    ...statuses
      .filter((status) => status.countsAs === "OPEN" && !status.isTerminal)
      .map((status) => ({ label: status.label, ids: [status.id] })),
    ...(accepted.length ? [{ label: accepted[0].label, ids: accepted.map((status) => status.id) }] : []),
  ];
  const reachedCounts = stages.map((stage, index) =>
    index === 0
      ? total
      : applications.filter(
          (application) =>
            stage.ids.includes(application.statusId) || stage.ids.some((id) => entered.get(id)?.has(application.id)),
        ).length,
  );
  const funnel = stages.map((stage, index) => ({
    label: stage.label,
    reached: reachedCounts[index],
    ofTotal: total ? reachedCounts[index] / total : 0,
    ofPrevious: index === 0 ? 1 : reachedCounts[index - 1] ? reachedCounts[index] / reachedCounts[index - 1] : 0,
  }));

  const appliedAt = new Map(applications.map((application) => [application.id, application.appliedAt]));
  const hireDays = [...firstAccepted].flatMap(([id, at]) => {
    const applied = appliedAt.get(id);
    return applied ? [(at.getTime() - applied.getTime()) / DAY_MS] : [];
  });

  const connected = calls.filter((call) => call.disposition === "CONNECTED").length;

  return {
    total,
    archived: applications.filter((application) => application.archivedAt).length,
    hires: applications.filter((application) => countsAs(application) === "ACCEPTED").length,
    rejectedShare: total ? applications.filter((application) => countsAs(application) === "REJECTED").length / total : 0,
    applicationsPerWeek: weekly(applications.map((application) => application.appliedAt)),
    callsPerWeek: weekly(calls.map((call) => call.startedAt)),
    byStatus: statuses
      .map((status) => ({ status, count: applications.filter((application) => application.statusId === status.id).length }))
      .filter((row) => row.status.active || row.count > 0),
    bySource: APPLICATION_SOURCES.map((source) => ({
      source,
      count: applications.filter((application) => application.source === source).length,
    })),
    funnel,
    timeToHire: hireDays.length
      ? { median: median(hireDays), min: Math.min(...hireDays), max: Math.max(...hireDays), hires: hireDays.length }
      : null,
    calls: {
      total: calls.length,
      connected,
      connectRate: calls.length ? connected / calls.length : 0,
      byDisposition: CALL_OUTCOMES.map((disposition) => ({
        disposition,
        count: calls.filter((call) => call.disposition === disposition).length,
      })),
    },
  };
}

export type Analytics = ReturnType<typeof computeAnalytics>;

export function getAnalytics(now = new Date()) {
  return computeAnalytics({
    applications: listApplications(),
    statuses: getStatuses(),
    activity: listActivity(),
    calls: listCallLogs(),
    now,
  });
}
