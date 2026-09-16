/**
 * The countsAs vocabulary, in a module that never touches the store.
 *
 * The status editor is a client component. Importing a value from any module
 * that reaches lib/store.ts would pull `fs` into the client bundle and fail the
 * build, so shared constants live here.
 */
export const COUNTS_AS_VALUES = ["OPEN", "ACCEPTED", "REJECTED"] as const;

export type StatusCountsAs = (typeof COUNTS_AS_VALUES)[number];

export const countsAsLabel: Record<StatusCountsAs, string> = {
  OPEN: "Open",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
};
