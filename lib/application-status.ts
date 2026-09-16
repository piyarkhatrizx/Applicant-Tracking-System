import { listStatuses, type Status } from "@/lib/data";

/**
 * Statuses are rows, not an enum.
 *
 * Nothing may hardcode a status name. Analytics derives accepted and rejected
 * from `countsAs`, so renaming "Hired" to "Placed" changes a label and nothing
 * else. Client components that need the countsAs vocabulary import it from
 * lib/status-counts-as.ts, which never touches the store.
 */

/** Every status in board order, inactive ones included. File order is not board order. */
export function getStatuses(): Status[] {
  return listStatuses().sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));
}

/** Only statuses a recruiter may move an application into. */
export function getActiveStatuses() {
  return getStatuses().filter((status) => status.active);
}

/** The status a new application starts in: the first active, open one in board order. */
export function getDefaultStatus() {
  return getStatuses().find((status) => status.active && status.countsAs === "OPEN") ?? null;
}
