import { activityPayloadSchema, type ActivityType, type PayloadBody } from "@/lib/activity/types";
import { insertActivity, patchApplication } from "@/lib/data";

/** Who a human action is attributed to. The demo has no sign-in. */
export const DEMO_RECRUITER = "Demo recruiter";

export type WriteActivityInput<T extends ActivityType = ActivityType> = {
  applicationId: number;
  type: T;
  payload: PayloadBody<T>;
  /**
   * Required, never defaulted. A person's name for a human action, null for a
   * system write such as intake from /apply.
   *
   * null is stored blank, and blank is also the store's only null. That is not
   * a collision: no code path writes a human action without a name, so a blank
   * actor always means "the system" and never "unknown".
   */
  actor: string | null;
  createdAt?: Date;
};

/**
 * The only way an activity row is written.
 *
 * The payload is validated before the store is touched, so an invalid shape
 * throws instead of persisting something the timeline cannot render.
 */
export function writeActivity<T extends ActivityType>(input: WriteActivityInput<T>) {
  const payload = activityPayloadSchema.parse({ type: input.type, ...input.payload });
  // The discriminant is redundant with the type column, so it is not stored twice.
  const stored: Record<string, unknown> = { ...payload };
  delete stored.type;
  const createdAt = input.createdAt ?? new Date();

  const id = insertActivity({
    applicationId: input.applicationId,
    type: input.type,
    payload: stored,
    actor: input.actor,
    createdAt,
  });
  // updated_at tracks the latest event on the application, as the seed writes it.
  patchApplication(input.applicationId, { updatedAt: createdAt });
  return id;
}
