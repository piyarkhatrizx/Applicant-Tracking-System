/**
 * moveApplicationStatus now lives in app/actions/activity.ts, so that every
 * Activity write goes through writeActivity. Re-exported here because
 * ApplicationStatusCell and the existing tests import from this path, and a
 * move that silently breaks a call site is worse than an extra file.
 *
 * No "use server" directive: a plain module may re-export a server action, and
 * a "use server" file is not allowed to export types.
 */
export { moveApplicationStatus } from "@/app/actions/activity";
export type { ActionResult, StatusChangeResult } from "@/app/actions/activity";
