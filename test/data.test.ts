import { describe, expect, it } from "vitest";
import { groupPeople, toApplication } from "@/lib/data";
import { normalizeEmail, normalizePhone } from "@/lib/normalize";

function applicantRow(overrides: Record<string, string> = {}) {
  return {
    id: "1",
    job_id: "2",
    first_name: "Ada",
    last_name: "Okafor",
    email: "ada@example.com",
    phone: "2165550100",
    location: "",
    current_title: "",
    current_employer: "",
    linkedin_url: "",
    source: "APPLY_FORM",
    status_id: "3",
    is_at_least_18: "true",
    is_cpa_certified: "",
    patient_uses_medicare: "false",
    caregiving_interest: "GENERAL_CAREGIVER",
    applied_at: "2026-09-01T14:00:00.000Z",
    updated_at: "2026-09-02T15:30:00.000Z",
    archived_at: "",
    ...overrides,
  };
}

describe("contact normalization", () => {
  it("lowercases and trims email, and treats blank as absent", () => {
    expect(normalizeEmail("  Ada@Example.COM ")).toBe("ada@example.com");
    expect(normalizeEmail("   ")).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
  });

  it("keeps the last ten phone digits and refuses too few", () => {
    expect(normalizePhone("+1 (216) 555-0100")).toBe("2165550100");
    expect(normalizePhone("555-01")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });
});

describe("candidate dedupe", () => {
  it("matches on email before phone", () => {
    const people = groupPeople([
      { id: "1", email: "Ada@Example.com", phone: "2165550100" },
      { id: "2", email: "other@example.com", phone: "+1 (330) 555-0111" },
      // Email points at row 1, phone at row 2. Email wins.
      { id: "3", email: "ada@example.com", phone: "3305550111" },
    ]);
    expect(people.get(3)).toBe(1);
    expect(people.get(2)).toBe(2);
  });

  it("falls back to phone when no email matches", () => {
    const people = groupPeople([
      { id: "1", email: "", phone: "(216) 555-0100" },
      { id: "2", email: "new@example.com", phone: "216.555.0100" },
    ]);
    expect(people.get(2)).toBe(1);
  });

  it("never matches on a blank contact, so a shared name alone joins nobody", () => {
    const people = groupPeople([
      { id: "1", email: "", phone: "" },
      { id: "2", email: "", phone: "" },
    ]);
    expect(people.get(1)).toBe(1);
    expect(people.get(2)).toBe(2);
  });

  it("identifies a candidate by their first row, whatever order rows arrive in", () => {
    const people = groupPeople([
      { id: "9", email: "ada@example.com", phone: "" },
      { id: "4", email: "ada@example.com", phone: "" },
    ]);
    expect(people.get(9)).toBe(4);
    expect(people.get(4)).toBe(4);
  });
});

describe("applicant row coercion", () => {
  it("turns cells into numbers and dates, and blank into null", () => {
    const application = toApplication(applicantRow(), 1);
    expect(application).toMatchObject({
      id: 1,
      candidateId: 1,
      jobId: 2,
      statusId: 3,
      source: "APPLY_FORM",
      archivedAt: null,
    });
    expect(application.appliedAt.toISOString()).toBe("2026-09-01T14:00:00.000Z");
    expect(application.updatedAt.toISOString()).toBe("2026-09-02T15:30:00.000Z");
  });

  it("reads a blank optional answer as not answered, never as no", () => {
    expect(toApplication(applicantRow(), 1).screening).toEqual({
      isAtLeast18: true,
      isCpaCertified: null,
      patientUsesMedicare: false,
      caregivingInterest: "GENERAL_CAREGIVER",
    });
    expect(toApplication(applicantRow({ is_cpa_certified: "false" }), 1).screening?.isCpaCertified).toBe(false);
  });

  it("has no screening block when the required first answer is blank", () => {
    const row = applicantRow({
      source: "EMAIL",
      is_at_least_18: "",
      is_cpa_certified: "",
      patient_uses_medicare: "",
      caregiving_interest: "",
    });
    expect(toApplication(row, 1).screening).toBeNull();
  });

  it("reads a filled timestamp as a date", () => {
    const row = applicantRow({ archived_at: "2026-09-05T13:00:00.000Z" });
    expect(toApplication(row, 1).archivedAt?.toISOString()).toBe("2026-09-05T13:00:00.000Z");
  });

  it("refuses a corrupt row, naming the column but never a value", () => {
    expect(() => toApplication(applicantRow({ source: "CARRIER_PIGEON" }), 1)).toThrow(/source/);
    expect(() => toApplication(applicantRow({ applied_at: "" }), 1)).toThrow(/applied_at/);

    let message = "";
    try {
      toApplication(applicantRow({ applied_at: "not a date" }), 1);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/applied_at/);
    expect(message).not.toMatch(/Ada|Okafor|ada@example\.com|2165550100/);
  });
});
