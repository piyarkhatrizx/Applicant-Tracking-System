"use client";

import { useState, useTransition } from "react";
import { addNote } from "@/app/actions/activity";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";

export function NoteComposer({ candidateId }: { candidateId: number }) {
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    const text = body.trim();
    if (!text) return;
    startTransition(async () => {
      const result = await addNote({ candidateId, body: text });
      if (result.ok) {
        setBody("");
        toast.success("Note added");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-[var(--space-3)] shadow-[var(--shadow-card)]">
      <label htmlFor="note-body" className="sr-only">
        Add a note
      </label>
      <Textarea
        id="note-body"
        rows={3}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Add a note about this candidate…"
      />
      <div className="mt-[var(--space-2)] flex justify-end">
        <Button size="sm" onClick={submit} loading={pending} disabled={!body.trim()}>
          Add note
        </Button>
      </div>
    </div>
  );
}
