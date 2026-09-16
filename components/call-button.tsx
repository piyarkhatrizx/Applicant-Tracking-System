"use client";

import { useState } from "react";
import { SimulatedCallModal } from "@/components/calls/simulated-call-modal";
import { Button } from "@/components/ui/button";
import { isCallDisabled } from "@/lib/activity/call";

/** Opens a simulated call for one application. */
export function CallButton({
  applicationId,
  name,
  phone,
}: {
  applicationId: number | null;
  name: string;
  phone: string | null;
}) {
  const [open, setOpen] = useState(false);
  const disabled = isCallDisabled(phone) || applicationId === null;

  return (
    <>
      <Button
        variant="secondary"
        disabled={disabled}
        title={disabled ? "No phone number on file" : "Opens a simulated call. Nothing dials out."}
        onClick={() => setOpen(true)}
      >
        Call
      </Button>
      {applicationId !== null && (
        <SimulatedCallModal applicant={{ applicationId, name, phone }} open={open} onOpenChange={setOpen} />
      )}
    </>
  );
}
