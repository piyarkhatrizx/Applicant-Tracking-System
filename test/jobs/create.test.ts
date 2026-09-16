import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Creating a posting writes, so the store points at a scratch directory. Never data/.
vi.mock("@/lib/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/store")>();
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const scratchDir = mkdtempSync(join(tmpdir(), "jobs-"));
  return { ...actual, ...actual.createStore(scratchDir), scratchDir };
});

import * as store from "@/lib/store";
import { createJobPosting } from "@/app/actions/jobs";
import { listJobs } from "@/lib/data";

const scratchDir = (store as unknown as { scratchDir: string }).scratchDir;

beforeEach(() => {
  fs.copyFileSync(path.join("data", "jobs.csv"), path.join(scratchDir, "jobs.csv"));
  fs.copyFileSync(path.join("data", "job_fields.csv"), path.join(scratchDir, "job_fields.csv"));
});

const EMAIL_FIELD = { key: "email", label: "Email", type: "TEXT" as const, options: [], required: true };

afterAll(() => fs.rmSync(scratchDir, { recursive: true, force: true }));

describe("createJobPosting", () => {
  it("adds a posting with the next code in the series", async () => {
    const before = listJobs();
    const result = await createJobPosting({
      title: "  Home Health Aide ",
      location: "Cleveland, OH",
      description: "Daily visits, meals and companionship.",
      status: "OPEN",
      fields: [EMAIL_FIELD],
    });

    expect(result).toEqual({ ok: true, data: { id: before.length + 1, code: `CARE-${String(before.length + 1).padStart(3, "0")}`, title: "Home Health Aide" } });
    expect(listJobs().at(-1)).toMatchObject({
      title: "Home Health Aide",
      location: "Cleveland, OH",
      description: "Daily visits, meals and companionship.",
      status: "OPEN",
      employmentType: null,
    });
  });

  it("stores a blank description as none and accepts closed", async () => {
    await createJobPosting({
      title: "Weekend Aide",
      location: "Parma, OH",
      description: "   ",
      status: "CLOSED",
      fields: [EMAIL_FIELD],
    });
    expect(listJobs().at(-1)).toMatchObject({ title: "Weekend Aide", description: null, status: "CLOSED" });
  });

  it("refuses incomplete or invalid input without writing", async () => {
    const count = listJobs().length;
    const bad = [
      { title: "", location: "Cleveland, OH", status: "OPEN" as const, fields: [EMAIL_FIELD] },
      { title: "Aide", location: "  ", status: "OPEN" as const, fields: [EMAIL_FIELD] },
      { title: "x".repeat(81), location: "Cleveland, OH", status: "OPEN" as const, fields: [EMAIL_FIELD] },
      { title: "Aide", location: "Cleveland, OH", status: "PAUSED" as never, fields: [EMAIL_FIELD] },
      // Neither email nor phone survives: intake could never dedupe this job's applicants.
      {
        title: "Aide",
        location: "Cleveland, OH",
        status: "OPEN" as const,
        fields: [{ key: "first_name", label: "First name", type: "TEXT" as const, options: [], required: false }],
      },
    ];
    for (const input of bad) {
      expect((await createJobPosting(input)).ok, JSON.stringify(input)).toBe(false);
    }
    expect(listJobs()).toHaveLength(count);
  });
});
