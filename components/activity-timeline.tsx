import { IconArrowRight } from "@/components/korosha/icon";
import { StatusPill } from "@/components/korosha/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { formatPhoneLabel } from "@/lib/activity/call";
import { groupByDay, type TimelineEntry } from "@/lib/activity/timeline";
import { sourceLabel } from "@/lib/application-source";
import { DISPOSITION_LABEL, formatCallDuration } from "@/lib/calls/summary";

function dayLabel(day: string) {
  const date = new Date(`${day}T00:00:00Z`);
  const today = new Date().toISOString().slice(0, 10);
  if (day === today) return "Today";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Renders one entry's headline. Unknown rows fall through to type + time. */
function EntryLine({ entry }: { entry: TimelineEntry }) {
  if (!entry.known) {
    return (
      <span className="text-[var(--ink-muted)]">
        <span className="font-mono text-xs">{entry.type}</span>{" "}
        <span className="text-xs">
          ({entry.reason === "unknown-type" ? "unrecognized type" : "unrecognized shape"})
        </span>
      </span>
    );
  }

  const { payload } = entry;
  switch (payload.type) {
    case "APPLICATION_CREATED":
      return <>Applied via {sourceLabel[payload.source]}</>;
    case "REAPPLIED":
      return <>Re-applied via {sourceLabel[payload.source]}</>;
    case "STATUS_CHANGED":
      return (
        <span className="inline-flex flex-wrap items-center gap-[var(--space-1)]">
          Moved
          {/* The label snapshot from the payload, not the status's current
              name: a rename must not rewrite what history says happened. */}
          <StatusPill label={payload.from} />
          <IconArrowRight size="1em" className="shrink-0 text-[var(--ink-muted)]" />
          <StatusPill label={payload.to} />
        </span>
      );
    case "NOTE_ADDED":
      return <>Note added</>;
    case "CALL_LOGGED": {
      const call = entry.row.call;
      if (!call) return <>Call logged</>;
      return (
        <>
          {call.direction === "OUTBOUND" ? "Called" : "Call from"}{" "}
          {formatPhoneLabel(call.phoneNumber)} — {DISPOSITION_LABEL[call.disposition]}
          {call.durationSeconds ? ` (${formatCallDuration(call.durationSeconds)})` : ""}
        </>
      );
    }
    case "ARCHIVED":
      return <>Moved to History</>;
    case "RESTORED":
      return <>Restored from History</>;
  }
}

function Entry({ entry }: { entry: TimelineEntry }) {
  const { row } = entry;

  return (
    <li className="border-b border-[var(--line)] py-[var(--space-2)] last:border-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-[var(--space-3)] gap-y-[var(--space-1)]">
        <span className="text-sm">
          <EntryLine entry={entry} />
        </span>
        <span className="shrink-0 font-mono text-xs text-[var(--ink-muted)]">
          {row.createdAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
        </span>
      </div>
      {row.body && (
        <p className="mt-[var(--space-1)] whitespace-pre-wrap text-sm text-[var(--ink-muted)]">
          {row.body}
        </p>
      )}
      {(row.actor || row.jobTitle) && (
        <p className="mt-[var(--space-1)] text-xs text-[var(--ink-muted)]">
          {row.actor ?? "System"}
          {row.jobTitle ? ` · ${row.jobTitle}` : ""}
        </p>
      )}
    </li>
  );
}

export function ActivityTimeline({
  pinned,
  entries,
}: {
  pinned: TimelineEntry[];
  entries: TimelineEntry[];
}) {
  if (!pinned.length && !entries.length) {
    return (
      <EmptyState compact title="Nothing has happened on this candidate yet." />
    );
  }

  return (
    <div className="space-y-[var(--space-5)]">
      {pinned.length > 0 && (
        <section aria-label="Pinned" className="rounded-2xl border border-[var(--line-strong)] bg-[var(--surface)] px-[var(--space-3)] py-[var(--space-1)] shadow-[var(--shadow-card)]">
          <p className="pt-[var(--space-2)] text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]">
            Pinned
          </p>
          <ul>
            {pinned.map((entry) => (
              <Entry key={`pinned-${entry.row.id}`} entry={entry} />
            ))}
          </ul>
        </section>
      )}

      {groupByDay(entries).map((group) => (
        <section key={group.day}>
          <h3 className="sticky top-0 bg-[var(--background)] py-[var(--space-1)] text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
            {dayLabel(group.day)}
          </h3>
          <ul className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-[var(--space-3)] shadow-[var(--shadow-card)]">
            {group.entries.map((entry) => (
              <Entry key={entry.row.id} entry={entry} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
