import { describe, expect, it } from "vitest";
import { PAGE_SIZE, parseListParams, withParam } from "@/lib/list-params";

describe("list searchParams contract", () => {
  it("rejects an unknown sort key and falls back to the view default", () => {
    const parsed = parseListParams("leads", { sort: "candidate.ssn" });
    expect(parsed.sort).toBe("appliedAt");
    expect(parsed.rejected).toContain("sort");
  });

  it("rejects prototype keys, which an `in` check would have let through", () => {
    for (const bad of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
      const parsed = parseListParams("leads", { sort: bad });
      expect(parsed.sort, bad).toBe("appliedAt");
      expect(parsed.rejected, bad).toContain("sort");
    }
  });

  it("uses each key's natural direction, and dir overrides it", () => {
    expect(parseListParams("leads", {}).dir).toBe("desc");
    expect(parseListParams("leads", { sort: "name" }).dir).toBe("asc");
    const parsed = parseListParams("leads", { sort: "status", dir: "desc" });
    expect(parsed.sort).toBe("status");
    expect(parsed.dir).toBe("desc");
    expect(parsed.rejected).toEqual([]);
  });

  it("drops an unknown source, which is still a closed set", () => {
    const parsed = parseListParams("leads", { source: "CARRIER_PIGEON" });
    expect(parsed.source).toBeNull();
    expect(parsed.rejected).toContain("source");
  });

  it("passes a well-formed status key through, since statuses are rows", () => {
    const parsed = parseListParams("leads", { status: "AWAITING_DOCS" });
    expect(parsed.status).toBe("AWAITING_DOCS");
    expect(parsed.rejected).toEqual([]);
  });

  it("rejects a status key that is not key-shaped", () => {
    for (const bad of ["../etc", "a b", "x".repeat(65), "{}"]) {
      const parsed = parseListParams("leads", { status: bad });
      expect(parsed.status, bad).toBeNull();
      expect(parsed.rejected, bad).toContain("status");
    }
  });

  it("keeps valid filters", () => {
    const parsed = parseListParams("leads", { source: "APPLY_FORM", status: "PHONE_SCREEN" });
    expect(parsed.source).toBe("APPLY_FORM");
    expect(parsed.status).toBe("PHONE_SCREEN");
    expect(parsed.rejected).toEqual([]);
  });

  it("clamps junk and out-of-range pages to the first page", () => {
    for (const page of ["0", "-3", "abc", "1.5"]) {
      expect(parseListParams("leads", { page }).page).toBe(1);
    }
    const third = parseListParams("leads", { page: "3" });
    expect(third.page).toBe(3);
    expect(third.skip).toBe(2 * PAGE_SIZE);
    expect(third.take).toBe(PAGE_SIZE);
  });

  it("takes the first value when a param is repeated", () => {
    const parsed = parseListParams("leads", { source: ["EMAIL", "APPLY_FORM"] });
    expect(parsed.source).toBe("EMAIL");
  });

  it("trims a search and treats blank as no search", () => {
    expect(parseListParams("leads", { q: "  Okafor " }).q).toBe("Okafor");
    expect(parseListParams("leads", { q: "   " }).q).toBeNull();
    expect(parseListParams("leads", {}).q).toBeNull();
  });

  it("refuses an oversized search rather than scanning with it", () => {
    const parsed = parseListParams("leads", { q: "x".repeat(101) });
    expect(parsed.q).toBeNull();
    expect(parsed.rejected).toContain("q");
  });

  it("preserves other params when one changes, and resets page", () => {
    const query = { source: "EMAIL", sort: "status", page: "4" };
    expect(withParam(query, "source", "APPLY_FORM")).toBe("?sort=status&source=APPLY_FORM");
    expect(withParam(query, "source", null)).toBe("?sort=status");
    // Paging keeps the filters it was paging through.
    expect(withParam(query, "page", "5")).toBe("?source=EMAIL&sort=status&page=5");
  });
});
