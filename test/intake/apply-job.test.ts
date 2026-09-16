import fs from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";

// Reads only, but from a scratch jobs table so the cases are fixed, not whatever data/ holds.
vi.mock("@/lib/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/store")>();
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const scratchDir = mkdtempSync(join(tmpdir(), "apply-job-"));
  return { ...actual, ...actual.createStore(scratchDir), scratchDir };
});

import * as store from "@/lib/store";
import { DEFAULT_APPLY_JOB_CODE, resolveApplyJob } from "@/lib/apply-job";

const scratchDir = (store as unknown as { scratchDir: string }).scratchDir;
const header = fs.readFileSync(path.join("data", "jobs.csv"), "utf8").split("\n")[0].split(",");

function writeJobs(jobs: Array<[id: string, code: string, title: string, status: string, openedAt: string]>) {
  const rows = jobs.map(([id, code, title, status, openedAt]) =>
    header.map((column) => ({ id, code, title, status, opened_at: openedAt, location: "Cleveland, OH", employment_type: "FULL_TIME" })[column] ?? ""),
  );
  fs.writeFileSync(path.join(scratchDir, "jobs.csv"), store.serializeCsv([header, ...rows]));
}

afterAll(() => fs.rmSync(scratchDir, { recursive: true, force: true }));

describe("resolveApplyJob", () => {
  const jobs: Array<[string, string, string, string, string]> = [
    ["1", "CARE-001", "Home Health Caregiver", "OPEN", "2026-05-01T14:00:00.000Z"],
    ["2", "CARE-002", "Overnight Care Specialist", "OPEN", "2026-07-01T14:00:00.000Z"],
    ["3", "CARE-003", "Respite Care Aide", "PAUSED", "2026-08-01T14:00:00.000Z"],
    ["4", "CARE-004", "Weekend Companion", "CLOSED", "2026-08-15T14:00:00.000Z"],
  ];

  it("defaults to the named default code, not to whichever open job opened last", () => {
    writeJobs(jobs);
    expect(DEFAULT_APPLY_JOB_CODE).toBe("CARE-001");
    for (const ref of [undefined, null, "", "   "]) {
      const result = resolveApplyJob(ref);
      // CARE-002 opened more recently and is open; the default must still win.
      expect(result.ok && result.job.code, String(ref)).toBe("CARE-001");
    }
  });

  it("accepts a code in any case, or a numeric id", () => {
    writeJobs(jobs);
    const byCode = resolveApplyJob("care-001");
    const byId = resolveApplyJob("2");
    expect(byCode.ok && byCode.job.id).toBe(1);
    expect(byId.ok && byId.job.code).toBe("CARE-002");
  });

  it("refuses paused and closed requisitions with a message naming the job", () => {
    writeJobs(jobs);
    expect(resolveApplyJob("CARE-003")).toEqual({
      ok: false,
      status: 409,
      error: "Respite Care Aide is paused and is not accepting applications right now.",
    });
    expect(resolveApplyJob("4")).toEqual({
      ok: false,
      status: 409,
      error: "Weekend Companion has closed and is no longer accepting applications.",
    });
  });

  it("reports an unknown job as not found", () => {
    writeJobs(jobs);
    for (const ref of ["CARE-999", "0", "99", "../jobs"]) {
      const result = resolveApplyJob(ref);
      expect(result.ok, ref).toBe(false);
      if (!result.ok) expect(result.status, ref).toBe(404);
    }
  });

  it("refuses when the default is paused or missing, rather than filing somewhere else", () => {
    writeJobs(jobs.map((job) => (job[1] === "CARE-001" ? [job[0], job[1], job[2], "PAUSED", job[4]] : job)) as typeof jobs);
    expect(resolveApplyJob()).toEqual({
      ok: false,
      status: 409,
      error: "Home Health Caregiver is paused and is not accepting applications right now.",
    });

    writeJobs(jobs.filter(([, code]) => code !== "CARE-001"));
    expect(resolveApplyJob()).toEqual({
      ok: false,
      status: 409,
      error: "We are not accepting applications right now. Please check back soon.",
    });
  });
});
