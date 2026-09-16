import fs from "node:fs";
import { describe, expect, it } from "vitest";
import type { CallDirection, CallOutcome } from "@/lib/activity/types";
import { callSummary, formatCallDuration } from "@/lib/calls/summary";
import { parseCsv } from "@/lib/store";

function table(name: string) {
  const [header, ...records] = parseCsv(fs.readFileSync(`data/${name}.csv`, "utf8"));
  return records.map((record) => Object.fromEntries(header.map((column, i) => [column, record[i] ?? ""])));
}

describe("call summaries", () => {
  it("regenerate every seeded summary word for word, so live and seeded calls read alike", () => {
    const applicants = new Map(table("applicants").map((row) => [row.id, row]));
    const seeded = table("call_logs").filter((call) => call.summary);
    expect(seeded.length).toBeGreaterThan(100);

    for (const call of seeded) {
      const person = applicants.get(call.applicant_id)!;
      const regenerated = callSummary({
        name: `${person.first_name} ${person.last_name}`,
        phoneNumber: call.phone_number,
        direction: call.direction as CallDirection,
        disposition: call.disposition as CallOutcome,
        durationSeconds: Number(call.duration_seconds),
        notes: call.notes || null,
      });
      expect(regenerated, `call ${call.id}`).toBe(call.summary);
    }
  });

  it("formats durations the way the seed does", () => {
    expect(formatCallDuration(0)).toBe("0s");
    expect(formatCallDuration(35)).toBe("35s");
    expect(formatCallDuration(60)).toBe("1m 00s");
    expect(formatCallDuration(605)).toBe("10m 05s");
  });

  it("leaves out the notes line when there are no notes", () => {
    const summary = callSummary({
      name: "Ada Okafor",
      phoneNumber: "2165550100",
      direction: "OUTBOUND",
      disposition: "VOICEMAIL",
      durationSeconds: 41,
      notes: null,
    });
    expect(summary).toBe(
      "Outbound call to Ada Okafor, (216) 555-0100.\nOutcome: Left voicemail. Duration: 41s.\nNext step: Try again tomorrow if there is no callback.",
    );
  });
});
