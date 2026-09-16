import { describe, expect, it } from "vitest";
import { leadMatches, matchesSearch, sinceLabel } from "@/lib/leads/query";
import { parseListParams } from "@/lib/list-params";

type LeadOverrides = {
  source?: "APPLY_FORM" | "EMAIL";
  jobId?: number;
  status?: string;
  called?: boolean;
  archived?: boolean;
};

function lead(overrides: LeadOverrides = {}) {
  return {
    application: {
      source: overrides.source ?? "APPLY_FORM",
      jobId: overrides.jobId ?? 1,
      archivedAt: overrides.archived ? new Date("2026-09-01T14:00:00Z") : null,
    },
    candidate: { firstName: "Ada", lastName: "Okafor", email: "ada.okafor@example.com", phone: "2165550100" },
    status: { key: overrides.status ?? "NEW" },
    called: overrides.called ?? false,
  };
}

const none = { source: null, status: null, job: null, uncalled: false, q: null };

describe("lead inbox filters", () => {
  it("matches every active lead when no filter is set", () => {
    expect(leadMatches(lead(), none)).toBe(true);
    expect(leadMatches(lead({ source: "EMAIL", called: true }), none)).toBe(true);
  });

  it("hides archived leads by default and lists only them when asked", () => {
    expect(leadMatches(lead({ archived: true }), none)).toBe(false);
    expect(leadMatches(lead({ archived: true }), { ...none, archived: true })).toBe(true);
    expect(leadMatches(lead(), { ...none, archived: true })).toBe(false);
  });

  it("derives uncalled from the called flag, which the query builds from the activity log", () => {
    expect(leadMatches(lead({ called: false }), { ...none, uncalled: true })).toBe(true);
    expect(leadMatches(lead({ called: true }), { ...none, uncalled: true })).toBe(false);
  });

  it("scopes to a requisition by id, which is what carries /jobs/[id] bookmarks over", () => {
    expect(leadMatches(lead({ jobId: 2 }), { ...none, job: 2 })).toBe(true);
    expect(leadMatches(lead({ jobId: 3 }), { ...none, job: 2 })).toBe(false);
  });

  it("filters status by key, since statuses are rows", () => {
    expect(leadMatches(lead({ status: "SCREENING" }), { ...none, status: "SCREENING" })).toBe(true);
    expect(leadMatches(lead({ status: "NEW" }), { ...none, status: "SCREENING" })).toBe(false);
  });

  it("combines search with every other filter rather than replacing them", () => {
    const filters = { source: "APPLY_FORM" as const, status: "NEW", job: 2, uncalled: true, q: "okafor" };
    expect(leadMatches(lead({ jobId: 2 }), filters)).toBe(true);
    expect(leadMatches(lead({ jobId: 2, source: "EMAIL" }), filters)).toBe(false);
    expect(leadMatches(lead({ jobId: 2, called: true }), filters)).toBe(false);
    expect(leadMatches(lead({ jobId: 2 }), { ...filters, q: "webb" })).toBe(false);
  });
});

describe("lead search", () => {
  const person = lead().candidate;

  it("matches part of a name in any case, including across first and last", () => {
    for (const query of ["ada", "OKAF", "a okaf", "Ada Okafor"]) {
      expect(matchesSearch(person, query), query).toBe(true);
    }
    expect(matchesSearch(person, "okafor ada")).toBe(false);
  });

  it("matches part of an email in any case", () => {
    expect(matchesSearch(person, "Okafor@Example")).toBe(true);
    expect(matchesSearch(person, "@example.org")).toBe(false);
  });

  it("matches phone digits however the query is formatted", () => {
    for (const query of ["216", "(216) 555-01", "555 0100", "5550100"]) {
      expect(matchesSearch(person, query), query).toBe(true);
    }
    expect(matchesSearch(person, "330")).toBe(false);
  });

  it("ignores fewer than three digits, so a stray number does not match everyone", () => {
    expect(matchesSearch(person, "21")).toBe(false);
  });

  it("matches everyone when the search is empty", () => {
    expect(matchesSearch(person, null)).toBe(true);
  });

  it("copes with a person missing name, email or phone", () => {
    const sparse = { firstName: null, lastName: "Webb", email: null, phone: null };
    expect(matchesSearch(sparse, "webb")).toBe(true);
    expect(matchesSearch(sparse, "216")).toBe(false);
  });
});

describe("lead searchParams", () => {
  it("defaults to newest first", () => {
    const parsed = parseListParams("leads", {});
    expect(parsed.sort).toBe("appliedAt");
    expect(parsed.dir).toBe("desc");
    expect(parsed.uncalled).toBe(false);
    expect(parsed.job).toBeNull();
  });

  it("reads uncalled only from an explicit 1", () => {
    expect(parseListParams("leads", { uncalled: "1" }).uncalled).toBe(true);
    for (const value of ["0", "true", "yes", ""]) {
      expect(parseListParams("leads", { uncalled: value }).uncalled).toBe(false);
    }
  });

  it("accepts a numeric job id and rejects anything else", () => {
    expect(parseListParams("leads", { job: "12" }).job).toBe(12);
    for (const bad of ["../etc", "a b", "0", "abc", "1".repeat(10)]) {
      const parsed = parseListParams("leads", { job: bad });
      expect(parsed.job, bad).toBeNull();
      expect(parsed.rejected, bad).toContain("job");
    }
  });
});

describe("time since applied", () => {
  const now = new Date("2026-09-07T12:00:00Z").getTime();
  const ago = (ms: number) => new Date(now - ms);

  it("reads compactly at every scale", () => {
    expect(sinceLabel(ago(30_000), now)).toBe("now");
    expect(sinceLabel(ago(5 * 60_000), now)).toBe("5m");
    expect(sinceLabel(ago(3 * 3_600_000), now)).toBe("3h");
    expect(sinceLabel(ago(2 * 86_400_000), now)).toBe("2d");
    expect(sinceLabel(ago(90 * 86_400_000), now)).toBe("3mo");
  });

  it("never renders a negative age from clock skew", () => {
    expect(sinceLabel(new Date(now + 60_000), now)).toBe("now");
  });
});
