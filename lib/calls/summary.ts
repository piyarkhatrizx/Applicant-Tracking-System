import { formatPhoneLabel } from "@/lib/activity/call";
import type { CallDirection, CallOutcome } from "@/lib/activity/types";

/**
 * The words a call summary is made of.
 *
 * scripts/seed.py (call_summary, DISPOSITION_LABEL, NEXT_STEP) writes the same
 * text for seeded calls, so a seeded call and a live one read alike.
 * test/calls/summary.test.ts regenerates every seeded summary with this module
 * and fails on any difference, so the two cannot drift.
 *
 * Pure and store-free: the call modal imports the labels.
 */
export const DISPOSITION_LABEL: Record<CallOutcome, string> = {
  CONNECTED: "Reached",
  VOICEMAIL: "Left voicemail",
  NO_ANSWER: "No answer",
  WRONG_NUMBER: "Wrong number",
  CALLBACK_REQUESTED: "Callback requested",
};

const NEXT_STEP: Record<CallOutcome, string> = {
  CONNECTED: "Update the applicant's stage to match the conversation.",
  VOICEMAIL: "Try again tomorrow if there is no callback.",
  NO_ANSWER: "Try again at a different time of day.",
  CALLBACK_REQUESTED: "Call back at the time requested.",
  WRONG_NUMBER: "Confirm the number by email before calling again.",
};

/** 35 -> "35s", 605 -> "10m 05s". */
export function formatCallDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes ? `${minutes}m ${String(rest).padStart(2, "0")}s` : `${rest}s`;
}

export function callSummary(call: {
  name: string;
  phoneNumber: string;
  direction: CallDirection;
  disposition: CallOutcome;
  durationSeconds: number;
  notes: string | null;
}) {
  const lines = [
    `${call.direction === "OUTBOUND" ? "Outbound call to" : "Inbound call from"} ${call.name}, ${formatPhoneLabel(call.phoneNumber)}.`,
    `Outcome: ${DISPOSITION_LABEL[call.disposition]}. Duration: ${formatCallDuration(call.durationSeconds)}.`,
  ];
  if (call.notes) lines.push(`Notes: ${call.notes}`);
  lines.push(`Next step: ${NEXT_STEP[call.disposition]}`);
  return lines.join("\n");
}
