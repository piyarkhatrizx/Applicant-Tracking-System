/**
 * Where an application came from. EMAIL appears in seed data only: it stands
 * for the resumes the production version ingested by email and parsed.
 */
export const APPLICATION_SOURCES = ["APPLY_FORM", "EMAIL", "REFERRAL", "MANUAL"] as const;

export type ApplicationSource = (typeof APPLICATION_SOURCES)[number];

export const sourceLabel: Record<ApplicationSource, string> = {
  APPLY_FORM: "Apply page",
  EMAIL: "Email",
  REFERRAL: "Referral",
  MANUAL: "Manual",
};

export const sourceTone = {
  APPLY_FORM: "interview",
  EMAIL: "new",
  REFERRAL: "screening",
  MANUAL: "neutral",
} as const;

/** Narrow an untrusted searchParam to a real source, or null for "All". */
export function parseSourceParam(value: string | string[] | undefined): ApplicationSource | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return APPLICATION_SOURCES.includes(candidate as ApplicationSource)
    ? (candidate as ApplicationSource)
    : null;
}
