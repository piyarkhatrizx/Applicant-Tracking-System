"use client";

import { useEffect, useState, useTransition } from "react";
import {
  completeSimulatedCall,
  getCallContext,
  type CallContext,
  type CallResult,
  type PriorCall,
} from "@/app/actions/calls";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { formatPhoneLabel } from "@/lib/activity/call";
import type { CallOutcome } from "@/lib/activity/types";
import { DISPOSITION_LABEL, formatCallDuration } from "@/lib/calls/summary";

export type { CallResult };

/** Who is being called. The modal loads everything else by application id. */
export type CallApplicant = {
  applicationId: number;
  name: string;
  phone: string | null;
};

/** The order a recruiter thinks in, not the enum's. */
const DISPOSITIONS: CallOutcome[] = ["CONNECTED", "VOICEMAIL", "NO_ANSWER", "CALLBACK_REQUESTED", "WRONG_NUMBER"];

const RING_MS = 2400;

type Phase = "connecting" | "connected" | "saving" | "logged";

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

const ordinal = (n: number) => {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
};

/**
 * A simulated outbound call. Nothing dials out.
 *
 * Deliberately standalone: it takes an applicant, loads its own context
 * (earlier calls, stages) through getCallContext, and reports the logged call
 * through onResult. It assumes nothing about the page that opened it, so a call
 * queue can drive it exactly as the candidate page and the leads inbox do.
 *
 * Unmounted while closed, so every open starts a fresh call.
 */
export function SimulatedCallModal({
  applicant,
  open,
  onOpenChange,
  onResult,
}: {
  applicant: CallApplicant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResult?: (result: CallResult) => void;
}) {
  if (!open || !applicant) return null;
  return (
    <CallSession
      key={applicant.applicationId}
      applicant={applicant}
      onClose={() => onOpenChange(false)}
      onResult={onResult}
    />
  );
}

function CallSession({
  applicant,
  onClose,
  onResult,
}: {
  applicant: CallApplicant;
  onClose: () => void;
  onResult?: (result: CallResult) => void;
}) {
  const [context, setContext] = useState<CallContext | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("connecting");
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [disposition, setDisposition] = useState<CallOutcome | null>(null);
  const [notes, setNotes] = useState("");
  const [moveTo, setMoveTo] = useState<number | null>(null);
  const [result, setResult] = useState<CallResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    getCallContext(applicant.applicationId).then((response) => {
      if (cancelled) return;
      if (response.ok) setContext(response.data);
      else setLoadError(response.error);
    });
    return () => {
      cancelled = true;
    };
  }, [applicant.applicationId]);

  // Ring, then connect.
  useEffect(() => {
    const timer = setTimeout(() => {
      setConnectedAt(Date.now());
      setPhase("connected");
    }, RING_MS);
    return () => clearTimeout(timer);
  }, []);

  // Read the wall clock rather than counting ticks, so a throttled tab never undercounts.
  useEffect(() => {
    if (phase !== "connected" || connectedAt === null) return;
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - connectedAt) / 1000)), 250);
    return () => clearInterval(interval);
  }, [phase, connectedAt]);

  const current = context?.statuses.find((status) => status.id === context.statusId);
  const nextStage =
    context && current ? context.statuses.find((status) => !status.isTerminal && status.order > current.order) : undefined;

  function hangUp() {
    if (!disposition || connectedAt === null) return;
    const seconds = Math.max(disposition === "CONNECTED" ? 1 : 0, Math.floor((Date.now() - connectedAt) / 1000));
    setElapsed(seconds);
    setError(null);
    setPhase("saving");
    startTransition(async () => {
      const response = await completeSimulatedCall({
        applicationId: applicant.applicationId,
        disposition,
        durationSeconds: seconds,
        notes,
        moveToStatusId: moveTo,
      });
      if (!response.ok) {
        setError(response.error);
        setPhase("connected");
        return;
      }
      setResult(response.data);
      setPhase("logged");
      if (response.data.statusError) toast.error(`Call logged, but the stage did not change: ${response.data.statusError}`);
      else toast.success(response.data.statusChange ? `Call logged, moved to ${response.data.statusChange.to}` : "Call logged");
      onResult?.(response.data);
    });
  }

  const inCall = phase === "connected" || phase === "saving";
  const phone = context?.phone ?? applicant.phone;

  return (
    <Dialog
      open
      // A live call cannot be dismissed by Escape or the scrim: it has to be hung up and logged.
      onOpenChange={(next) => {
        if (!next && !inCall) onClose();
      }}
      title="Simulated call"
      description="Demo only. No phone call is placed: the ringing, the connection and the timer are all simulated."
      dismissible={!inCall}
      className="w-[min(94vw,36rem)]"
      footer={
        phase === "connecting" ? (
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
        ) : phase === "logged" ? (
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            {!disposition && <span className="mr-auto text-xs text-[var(--ink-muted)]">Pick how the call went to hang up.</span>}
            <Button variant="primary" onClick={hangUp} disabled={!disposition} loading={phase === "saving"}>
              Hang up and log
            </Button>
          </>
        )
      }
    >
      <div className="space-y-[var(--space-4)]">
        <div className="flex items-start justify-between gap-[var(--space-3)] border border-dashed border-[var(--line-strong)] bg-[var(--surface-sunken)] px-[var(--space-3)] py-[var(--space-2)]">
          <div className="min-w-0">
            <p className="text-2xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
              Simulated · nothing dials out
            </p>
            <p className="mt-[var(--space-1)] truncate text-md font-semibold">{applicant.name}</p>
            <p className="k-tnum text-sm text-[var(--ink-muted)]">
              {phone ? formatPhoneLabel(phone) : "No number on file"}
              {context?.jobTitle ? ` · ${context.jobTitle}` : ""}
            </p>
          </div>
          <p role="status" aria-live="polite" className="shrink-0 text-right text-sm font-medium">
            {phase === "connecting" && (
              <span className="inline-flex items-center gap-[var(--space-2)]">
                <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-[var(--ink-faint)] motion-safe:animate-pulse" />
                Calling…
              </span>
            )}
            {inCall && (
              <span className="inline-flex items-center gap-[var(--space-2)]">
                <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-[var(--status-accepted)]" />
                Connected <span className="k-tnum">{clock(elapsed)}</span>
              </span>
            )}
            {phase === "logged" && (
              <span className="text-[var(--ink-muted)]">
                Call ended <span className="k-tnum">{clock(elapsed)}</span>
              </span>
            )}
          </p>
        </div>

        {loadError && (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {loadError}
          </p>
        )}

        {phase !== "logged" && context && <PriorAttempts calls={context.priorCalls} />}

        {inCall && (
          <>
            <fieldset className="border-0 p-0">
              <legend className="text-sm font-medium">How did the call go?</legend>
              <div className="mt-[var(--space-2)] flex flex-wrap gap-[var(--space-2)]">
                {DISPOSITIONS.map((value) => (
                  <label
                    key={value}
                    className={`cursor-pointer rounded-[4px] border px-[var(--space-3)] py-[var(--space-1)] text-sm ${
                      disposition === value
                        ? "border-[var(--accent-line)] bg-[var(--surface-selected)] font-medium"
                        : "border-[var(--line)] hover:border-[var(--line-strong)]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="disposition"
                      value={value}
                      checked={disposition === value}
                      onChange={() => setDisposition(value)}
                      className="sr-only"
                    />
                    {DISPOSITION_LABEL[value]}
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <label htmlFor="call-notes" className="mb-[var(--space-1)] block text-sm font-medium">
                Notes
              </label>
              <Textarea
                id="call-notes"
                rows={3}
                value={notes}
                maxLength={2000}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="What was said, when to call back…"
              />
            </div>

            {context && current && (
              <div>
                <label htmlFor="call-stage" className="mb-[var(--space-1)] block text-sm font-medium">
                  Stage after this call
                </label>
                <div className="flex flex-wrap items-center gap-[var(--space-2)]">
                  <select
                    id="call-stage"
                    value={moveTo ?? ""}
                    onChange={(event) => setMoveTo(event.target.value ? Number(event.target.value) : null)}
                    className="h-8 rounded-[4px] border border-[var(--line)] bg-[var(--surface)] px-[var(--space-2)] text-sm"
                  >
                    <option value="">Keep {current.label}</option>
                    {context.statuses
                      .filter((status) => status.id !== current.id)
                      .map((status) => (
                        <option key={status.id} value={status.id}>
                          Move to {status.label}
                        </option>
                      ))}
                  </select>
                  {disposition === "CONNECTED" && nextStage && moveTo !== nextStage.id && (
                    <Button variant="secondary" size="sm" onClick={() => setMoveTo(nextStage.id)}>
                      Screened on this call: move to {nextStage.label}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {error && (
              <p role="alert" className="text-sm text-[var(--danger)]">
                {error}
              </p>
            )}
          </>
        )}

        {phase === "logged" && result && (
          <div className="space-y-[var(--space-2)]">
            <p className="text-sm font-medium">Call summary</p>
            <p className="whitespace-pre-wrap rounded-[4px] border border-[var(--line)] bg-[var(--surface-sunken)] p-[var(--space-3)] text-sm leading-relaxed">
              {result.summary}
            </p>
            {result.statusChange && (
              <p className="text-sm">
                Moved from {result.statusChange.from} to {result.statusChange.to}.
              </p>
            )}
            {result.statusError && (
              <p role="alert" className="text-sm text-[var(--danger)]">
                The call was logged, but the stage did not change: {result.statusError}
              </p>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}

/**
 * What happened on earlier calls, newest first. A third voicemail calls for a
 * different message than a first attempt, so the count and the streak lead.
 */
function PriorAttempts({ calls }: { calls: PriorCall[] }) {
  if (!calls.length) {
    return <p className="text-sm text-[var(--ink-muted)]">First call to this person.</p>;
  }

  const tally = DISPOSITIONS.map((value) => [value, calls.filter((call) => call.disposition === value).length] as const)
    .filter(([, count]) => count > 0)
    .map(([value, count]) => `${DISPOSITION_LABEL[value].toLowerCase()} ${count}`)
    .join(", ");

  // Unanswered attempts in a row, most recent first.
  const latest = calls[0].disposition;
  const streakEnd = calls.findIndex((call) => call.disposition !== latest);
  const streak = latest === "CONNECTED" ? 0 : streakEnd === -1 ? calls.length : streakEnd;

  return (
    <section aria-label="Earlier calls" className="space-y-[var(--space-2)]">
      <p className="text-sm">
        <span className="font-semibold">{ordinal(calls.length + 1)} call to this person.</span>{" "}
        <span className="text-[var(--ink-muted)]">So far: {tally}.</span>
      </p>
      {streak >= 2 && (
        <p className="border-l-2 border-[var(--line-strong)] pl-[var(--space-2)] text-sm font-medium">
          The last {streak} calls all ended {DISPOSITION_LABEL[latest].toLowerCase()}.
        </p>
      )}
      <ol className="max-h-36 space-y-[var(--space-1)] overflow-y-auto text-xs text-[var(--ink-muted)]">
        {calls.slice(0, 6).map((call) => (
          <li key={call.id} className="flex flex-wrap gap-x-[var(--space-2)]">
            <span className="k-tnum">
              {new Date(call.startedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </span>
            <span className="font-medium text-[var(--foreground)]">{DISPOSITION_LABEL[call.disposition]}</span>
            {call.durationSeconds ? <span className="k-tnum">{formatCallDuration(call.durationSeconds)}</span> : null}
            {call.notes && <span className="min-w-0 truncate">“{call.notes}”</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}
