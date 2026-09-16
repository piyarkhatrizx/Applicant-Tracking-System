import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Intake writes, so the store is pointed at a scratch directory. Never data/.
vi.mock("@/lib/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/store")>();
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const scratchDir = mkdtempSync(join(tmpdir(), "intake-"));
  return { ...actual, ...actual.createStore(scratchDir), scratchDir };
});

import * as store from "@/lib/store";
import {
  findCandidate,
  insertApplication,
  listActivity,
  listApplications,
  listCandidates,
  patchApplication,
} from "@/lib/data";
import { intakeApplication } from "@/lib/intake";

const scratchDir = (store as unknown as { scratchDir: string }).scratchDir;

beforeEach(() => {
  // Empty tables with the real headers, read from data/ so they cannot drift.
  for (const table of ["applicants", "activity"]) {
    const header = fs.readFileSync(path.join("data", `${table}.csv`), "utf8").split("\n")[0];
    fs.writeFileSync(path.join(scratchDir, `${table}.csv`), `${header}\n`);
  }
});

afterAll(() => fs.rmSync(scratchDir, { recursive: true, force: true }));

const base = { jobId: 1, statusId: 1, source: "APPLY_FORM" as const, firstName: "Ada", lastName: "Okafor" };

const screening = (isCpaCertified: boolean | null) => ({
  isAtLeast18: true,
  isCpaCertified,
  patientUsesMedicare: false,
  caregivingInterest: "GENERAL_CAREGIVER" as const,
});

describe("intakeApplication", () => {
  it("creates a candidate and an application, and logs a system event", () => {
    const appliedAt = new Date("2026-09-01T14:00:00.000Z");
    const result = intakeApplication({ ...base, email: "Ada@Example.com", phone: "(216) 555-0100", appliedAt });

    expect(result).toEqual({ candidateId: 1, applicationId: 1, isNewCandidate: true, isNewApplication: true });
    expect(listApplications()[0]).toMatchObject({ jobId: 1, statusId: 1, source: "APPLY_FORM" });
    expect(findCandidate(1)).toMatchObject({ email: "ada@example.com", phone: "2165550100" });

    const [event] = listActivity();
    expect(event).toMatchObject({ applicationId: 1, type: "APPLICATION_CREATED", actor: null, payload: { source: "APPLY_FORM" } });
    expect(event.createdAt.toISOString()).toBe(appliedAt.toISOString());
  });

  it("never resets status or overwrites source on a re-apply, merges screening, and logs REAPPLIED", () => {
    intakeApplication({ ...base, email: "ada@example.com", screening: screening(null) });
    patchApplication(1, { statusId: 4 });

    const again = intakeApplication({ ...base, source: "REFERRAL", email: "ADA@example.com", screening: screening(true) });

    expect(again).toMatchObject({ applicationId: 1, isNewCandidate: false, isNewApplication: false });
    expect(listApplications()).toHaveLength(1);
    expect(listApplications()[0]).toMatchObject({ statusId: 4, source: "APPLY_FORM" });
    expect(listApplications()[0].screening?.isCpaCertified).toBe(true);
    expect(listActivity().map((event) => event.type)).toEqual(["APPLICATION_CREATED", "REAPPLIED"]);
  });

  it("matches on phone when the email differs, and keeps every row of the person in step", () => {
    intakeApplication({ ...base, email: "ada@example.com", phone: "2165550100" });
    const second = intakeApplication({
      ...base,
      jobId: 2,
      email: "ada.okafor@example.net",
      phone: "+1 216 555 0100",
      location: "Lakewood, OH",
    });

    expect(second).toMatchObject({ candidateId: 1, applicationId: 2, isNewCandidate: false, isNewApplication: true });
    expect(listApplications().map((application) => application.candidateId)).toEqual([1, 1]);
    expect(findCandidate(1)).toMatchObject({ email: "ada.okafor@example.net", location: "Lakewood, OH" });
  });

  it("never merges two people on name alone", () => {
    intakeApplication({ ...base, email: "ada@example.com" });
    const other = intakeApplication({ ...base, email: "someone.else@example.com", phone: "3305550199" });

    expect(other.isNewCandidate).toBe(true);
    expect(other.candidateId).not.toBe(1);
  });

  it("never groups two rows into one candidate because both emails are blank", () => {
    // "" is the store's only null, so a blank email must never act as a shared key.
    const blank = { email: null, phone: null, location: null, currentTitle: null, currentEmployer: null, linkedinUrl: null };
    const appliedAt = new Date("2026-09-01T14:00:00.000Z");
    insertApplication({ jobId: 1, statusId: 1, source: "MANUAL", screening: null, appliedAt, person: { ...blank, firstName: "Ada", lastName: "Okafor" } });
    insertApplication({ jobId: 1, statusId: 1, source: "MANUAL", screening: null, appliedAt, person: { ...blank, firstName: "Marcus", lastName: "Webb", email: "   " } });

    const candidates = listCandidates();
    expect(candidates).toHaveLength(2);
    expect(candidates.map((candidate) => `${candidate.firstName} ${candidate.lastName}`).sort()).toEqual(["Ada Okafor", "Marcus Webb"]);
  });

  it("refuses a submission with nothing to dedupe on", () => {
    expect(() => intakeApplication({ ...base, email: "   ", phone: "12" })).toThrow(/email or a phone/);
    expect(listApplications()).toHaveLength(0);
  });
});
