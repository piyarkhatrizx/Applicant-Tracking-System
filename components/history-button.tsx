"use client";

import { useTransition } from "react";
import { archiveApplication, restoreApplication } from "@/app/actions/activity";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

/** Moves one application into History, or restores it. Nothing is deleted either way. */
export function HistoryButton({ applicationId, inHistory }: { applicationId: number; inHistory: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button variant="secondary"
      size="sm"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const result = inHistory ? await restoreApplication(applicationId) : await archiveApplication(applicationId);
          if (result.ok) toast.success(inHistory ? "Restored from History" : "Moved to History");
          else toast.error(result.error);
        })
      }
    >
      {inHistory ? "Restore" : "Move to History"}
    </Button>
  );
}
