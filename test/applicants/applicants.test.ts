import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Deleting writes, so the store points at a scratch directory. Never data/.
vi.mock("@/lib/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/store")>();
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const scratchDir = mkdtempSync(join(tmpdir(), "applicants-"));
  return { ...actual, ...actual.createStore(scratchDir), scratchDir };
});

import * as store from "@/lib/store";
import { writeActivity } from "@/lib/activity/write";
import {
  deleteApplicationRows,
  insertApplication,
  insertCallLog,
  insertNote,
  listActivity,
  listApplications,
  listCallLogs,
  listNotes,
  patchApplication,
} from "@/lib/data";
import { getApplicants } from "@/lib/leads/query";

const scratchDir = (store as unknown as { scratchDir: string }).scratchDir;

function person(firstName: string, email: string, phone: string) {
  return { firstName, lastName: "Tester", email, phone, location: null, currentTitle: null, currentEmployer: null, linkedinUrl: null };
}

beforeEach(() => {
  for (const table of ["statuses", "jobs"]) {
    fs.copyFileSync(path.join("data", `${table}.csv`), path.join(scratchDir, `${table}.csv`));
  }
  for (const table of ["applicants", "activity", "call_logs", "notes", "application_field_values"]) {
    const header = fs.readFileSync(path.join("data", `${table}.csv`), "utf8").split("\n")[0];
    fs.writeFileSync(path.join(scratchDir, `${table}.csv`), `${header}\n`);
  }
  // Ada on job 1 (oldest), Bo on job 2, Cy on job 1 (newest). Cy then goes to History.
  insertApplication({ jobId: 1, statusId: 1, source: "APPLY_FORM", screening: null, person: person("Ada", "ada@example.com", "2165550100"), appliedAt: new Date("2026-09-01T14:00:00Z") });
  insertApplication({ jobId: 2, statusId: 2, source: "REFERRAL", screening: null, person: person("Bo", "bo@example.com", "2165550101"), appliedAt: new Date("2026-09-03T14:00:00Z") });
  insertApplication({ jobId: 1, statusId: 1, source: "EMAIL", screening: null, person: person("Cy", "cy@example.com", "2165550102"), appliedAt: new Date("2026-09-05T14:00:00Z") });
  patchApplication(3, { archivedAt: new Date("2026-09-06T14:00:00Z") });
});

afterAll(() => fs.rmSync(scratchDir, { recursive: true, force: true }));

describe("getApplicants", () => {
  it("lists applications not in History, newest applied first", () => {
    expect(getApplicants().map((lead) => lead.candidate.firstName)).toEqual(["Bo", "Ada"]);
  });

  it("filters to one job posting", () => {
    expect(getApplicants({ jobId: 1 }).map((lead) => lead.candidate.firstName)).toEqual(["Ada"]);
    expect(getApplicants({ jobId: 2 }).map((lead) => lead.candidate.firstName)).toEqual(["Bo"]);
    expect(getApplicants({ jobId: 999 })).toEqual([]);
  });
});

describe("deleteApplicationRows", () => {
  it("removes the application with its notes, calls and activity, and nothing belonging to anyone else", () => {
    const at = new Date("2026-09-07T14:00:00Z");
    for (const applicationId of [1, 2]) {
      const note = insertNote({ applicationId, body: "A note", pinned: false, createdAt: at });
      writeActivity({ applicationId, type: "NOTE_ADDED", payload: { noteId: String(note.id) }, actor: "Demo recruiter", createdAt: at });
      const call = insertCallLog({ applicationId, direction: "OUTBOUND", disposition: "VOICEMAIL", durationSeconds: 30, phoneNumber: "2165550100", notes: null, summary: "s", startedAt: at, endedAt: at });
      writeActivity({ applicationId, type: "CALL_LOGGED", payload: { callLogId: String(call.id) }, actor: "Demo recruiter", createdAt: at });
    }

    expect(deleteApplicationRows(1)).toBe(true);

    expect(listApplications().map((application) => application.id)).toEqual([2, 3]);
    expect(listNotes().map((note) => note.applicationId)).toEqual([2]);
    expect(listCallLogs().map((call) => call.applicationId)).toEqual([2]);
    expect(new Set(listActivity().map((record) => record.applicationId))).toEqual(new Set([2]));
    expect(deleteApplicationRows(1)).toBe(false);
  });
});
