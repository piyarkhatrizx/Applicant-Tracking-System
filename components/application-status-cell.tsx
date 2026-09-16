"use client";

import { moveApplicationStatus } from "@/app/actions/activity";
import { KStatusSelect, type StatusOption } from "@/components/korosha/status-select";

/**
 * The bridge between the status dropdown and the server action.
 *
 * The action's result is returned to KStatusSelect unchanged — no translation,
 * no throwing convention for a call site to forget. Server components render
 * this directly; they cannot pass the action inline because they may not hand
 * a function to a client component as a prop.
 */
export function ApplicationStatusCell({
  applicationId,
  statusId,
  statuses,
  align = "start",
}: {
  applicationId: number;
  statusId: number;
  statuses: StatusOption[];
  align?: "start" | "end";
}) {
  return (
    <KStatusSelect
      value={statusId}
      options={statuses}
      align={align}
      onChange={(nextStatusId) => moveApplicationStatus(applicationId, nextStatusId)}
    />
  );
}
