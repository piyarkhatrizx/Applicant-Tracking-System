import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/data", () => ({
  insertActivity: vi.fn(() => 1),
  patchApplication: vi.fn(() => true),
}));

import { formatPhoneLabel, isCallDisabled } from "@/lib/activity/call";
import { ACTIVITY_TYPES, activityPayloadSchema, safeParseActivity } from "@/lib/activity/types";
import { writeActivity } from "@/lib/activity/write";
import { insertActivity, patchApplication } from "@/lib/data";

describe("activity payload variants", () => {
  it("accepts the shape each call site writes", () => {
    const valid = [
      { type: "APPLICATION_CREATED", source: "APPLY_FORM" },
      { type: "REAPPLIED", source: "EMAIL" },
      { type: "STATUS_CHANGED", from: "New", to: "Screening", fromStatusId: "1", toStatusId: "2" },
      { type: "STATUS_CHANGED", from: "Offer", to: "Hired", fromStatusId: "5", toStatusId: "6", reassigned: true },
      { type: "NOTE_ADDED", noteId: "12" },
      { type: "CALL_LOGGED", callLogId: "7" },
      { type: "ARCHIVED" },
      { type: "RESTORED" },
    ];
    for (const payload of valid) {
      expect(activityPayloadSchema.safeParse(payload).success, JSON.stringify(payload)).toBe(true);
    }
    // Every type in the union has a variant.
    expect(new Set(valid.map((v) => v.type)).size).toBe(ACTIVITY_TYPES.length);
  });

  it("rejects the wrong payload for a type", () => {
    const invalid = [
      { type: "STATUS_CHANGED", source: "APPLY_FORM" },
      { type: "STATUS_CHANGED", from: "New", to: "Screening", fromStatusId: "s_1", toStatusId: "2" },
      { type: "APPLICATION_CREATED", source: "CARRIER_PIGEON" },
      { type: "NOTE_ADDED" },
      { type: "NOTE_ADDED", noteId: "0" },
      { type: "CALL_LOGGED", callLogId: "abc" },
      // Removed along with email intake.
      { type: "PARSED", documentId: "doc_1" },
    ];
    for (const payload of invalid) {
      expect(activityPayloadSchema.safeParse(payload).success, JSON.stringify(payload)).toBe(false);
    }
  });
});

describe("writeActivity", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refuses an invalid payload before touching the store", () => {
    expect(() =>
      writeActivity({ applicationId: 1, type: "NOTE_ADDED", payload: { noteId: "not-an-id" }, actor: null }),
    ).toThrow();
    expect(insertActivity).not.toHaveBeenCalled();
    expect(patchApplication).not.toHaveBeenCalled();
  });

  it("stores the payload without its discriminant, keeps a system actor null, and bumps updated_at", () => {
    const createdAt = new Date("2026-09-01T14:00:00Z");
    writeActivity({ applicationId: 4, type: "CALL_LOGGED", payload: { callLogId: "9" }, actor: null, createdAt });

    expect(insertActivity).toHaveBeenCalledWith({
      applicationId: 4,
      type: "CALL_LOGGED",
      payload: { callLogId: "9" },
      actor: null,
      createdAt,
    });
    expect(patchApplication).toHaveBeenCalledWith(4, { updatedAt: createdAt });
  });
});

describe("safeParseActivity", () => {
  it("marks an unrecognized type as unknown rather than throwing", () => {
    const parsed = safeParseActivity({ type: "SMOKE_SIGNAL_SENT", payload: { whatever: true } });
    expect(parsed.known).toBe(false);
    if (!parsed.known) expect(parsed.reason).toBe("unknown-type");
  });

  it("marks a known type with the wrong shape as unknown", () => {
    const parsed = safeParseActivity({ type: "STATUS_CHANGED", payload: { from: "NEW" } });
    expect(parsed.known).toBe(false);
    if (!parsed.known) expect(parsed.reason).toBe("unknown-shape");
  });

  it("tolerates a null or non-object payload", () => {
    for (const payload of [null, "a string", 42, ["a"]]) {
      expect(() => safeParseActivity({ type: "ARCHIVED", payload })).not.toThrow();
    }
  });
});

describe("call helpers", () => {
  it("disables the call button when there is no dialable number", () => {
    expect(isCallDisabled(null)).toBe(true);
    expect(isCallDisabled(undefined)).toBe(true);
    expect(isCallDisabled("")).toBe(true);
    expect(isCallDisabled("   ")).toBe(true);
    // Too few digits to dial.
    expect(isCallDisabled("555-01")).toBe(true);
    expect(isCallDisabled("2165550142")).toBe(false);
    expect(isCallDisabled("(216) 555-0142")).toBe(false);
  });

  it("formats ten digits for the label and leaves anything else alone", () => {
    expect(formatPhoneLabel("2165550142")).toBe("(216) 555-0142");
    expect(formatPhoneLabel("5550142")).toBe("5550142");
  });
});
