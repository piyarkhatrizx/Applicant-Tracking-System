import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Calls write, so the store points at a scratch directory. Never data/.
vi.mock("@/lib/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/store")>();
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const scratchDir = mkdtempSync(join(tmpdir(), "calls-"));
  return { ...actual, ...actual.createStore(scratchDir), scratchDir };
});

import * as store from "@/lib/store";
import { completeSimulatedCall, getCallContext } from "@/app/actions/calls";
import { callSummary } from "@/lib/calls/summary";
import { findApplication, insertApplication, listActivity, listCallLogs } from "@/lib/data";

const scratchDir = (store as unknown as { scratchDir: string }).scratchDir;

const person = {
  firstName: "Ada",
  lastName: "Okafor",
  email: "ada@example.com",
  phone: "2165550100",
  location: null,
  currentTitle: null,
  currentEmployer: null,
  linkedinUrl: null,
};

beforeEach(() => {
  // The real status and job tables; empty tables with real headers for the rest.
  for (const table of ["statuses", "jobs"]) {
    fs.copyFileSync(path.join("data", `${table}.csv`), path.join(scratchDir, `${table}.csv`));
  }
  for (const table of ["applicants", "activity", "call_logs", "notes"]) {
    const header = fs.readFileSync(path.join("data", `${table}.csv`), "utf8").split("\n")[0];
    fs.writeFileSync(path.join(scratchDir, `${table}.csv`), `${header}\n`);
  }
  // Same person on two requisitions, both in Screening (status 2).
  const appliedAt = new Date("2026-09-01T14:00:00.000Z");
  insertApplication({ jobId: 1, statusId: 2, source: "APPLY_FORM", screening: null, person, appliedAt });
  insertApplication({ jobId: 2, statusId: 2, source: "REFERRAL", screening: null, person, appliedAt });
});

afterAll(() => fs.rmSync(scratchDir, { recursive: true, force: true }));

describe("completeSimulatedCall", () => {
  it("writes the call with the seed's summary wording and a CALL_LOGGED event", async () => {
    const response = await completeSimulatedCall({ applicationId: 1, disposition: "VOICEMAIL", durationSeconds: 41, notes: "  Left a callback number. " });
    expect(response.ok).toBe(true);

    const [call] = listCallLogs();
    const expected = callSummary({ name: "Ada Okafor", phoneNumber: "2165550100", direction: "OUTBOUND", disposition: "VOICEMAIL", durationSeconds: 41, notes: "Left a callback number." });
    expect(call).toMatchObject({ applicationId: 1, direction: "OUTBOUND", disposition: "VOICEMAIL", durationSeconds: 41, notes: "Left a callback number.", summary: expected });
    expect((call.endedAt!.getTime() - call.startedAt.getTime()) / 1000).toBe(41);

    const [event] = listActivity();
    expect(event).toMatchObject({ applicationId: 1, type: "CALL_LOGGED", actor: "Demo recruiter", payload: { callLogId: String(call.id) } });
    expect(response.ok && response.data).toMatchObject({ callLogId: call.id, summary: expected, statusChange: null, statusError: null });
  });

  it("moves the application inline when asked, after logging the call", async () => {
    const response = await completeSimulatedCall({ applicationId: 1, disposition: "CONNECTED", durationSeconds: 300, moveToStatusId: 3 });

    expect(response.ok && response.data.statusChange).toEqual({ from: "Screening", to: "Phone screen" });
    expect(findApplication(1)?.statusId).toBe(3);
    expect(listActivity().map((event) => event.type)).toEqual(["CALL_LOGGED", "STATUS_CHANGED"]);
  });

  it("keeps the call when the stage change is refused, and says why", async () => {
    const response = await completeSimulatedCall({ applicationId: 1, disposition: "CONNECTED", durationSeconds: 30, moveToStatusId: 99 });

    expect(response.ok && response.data.statusError).toBe("That is not a valid stage.");
    expect(listCallLogs()).toHaveLength(1);
    expect(findApplication(1)?.statusId).toBe(2);
  });

  it("refuses bad input without writing anything", async () => {
    const bad = [
      { applicationId: 1, disposition: "TELEPATHY" as never, durationSeconds: 10 },
      { applicationId: 1, disposition: "CONNECTED" as const, durationSeconds: 0 },
      { applicationId: 1, disposition: "NO_ANSWER" as const, durationSeconds: -5 },
      { applicationId: 1, disposition: "NO_ANSWER" as const, durationSeconds: 1.5 },
      { applicationId: 999, disposition: "NO_ANSWER" as const, durationSeconds: 20 },
    ];
    for (const input of bad) {
      expect((await completeSimulatedCall(input)).ok, JSON.stringify(input)).toBe(false);
    }
    expect(listCallLogs()).toHaveLength(0);
    expect(listActivity()).toHaveLength(0);
  });
});

describe("getCallContext", () => {
  it("lists earlier calls to the person across all their applications, newest first", async () => {
    await completeSimulatedCall({ applicationId: 1, disposition: "VOICEMAIL", durationSeconds: 30 });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await completeSimulatedCall({ applicationId: 2, disposition: "NO_ANSWER", durationSeconds: 20 });

    const response = await getCallContext(1);
    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.data).toMatchObject({ applicationId: 1, name: "Ada Okafor", phone: "2165550100", statusId: 2 });
    expect(response.data.priorCalls.map((call) => call.disposition)).toEqual(["NO_ANSWER", "VOICEMAIL"]);
    expect(response.data.statuses.map((status) => status.label)).toContain("Phone screen");
  });
});
