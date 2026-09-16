"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldInput, type FieldSpec } from "@/components/apply/field-inputs";

/**
 * The public apply form for a job with a configured field set — everything
 * except CARE-001's fixed caregiver screening form (app/apply/apply-form.tsx),
 * which stays untouched for backward compatibility.
 */
export default function DynamicApplyForm({ jobCode, fields }: { jobCode: string; fields: FieldSpec[] }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [error, setError] = useState("");

  function update(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("submitting");
    const response = await fetch(`/api/apply/${encodeURIComponent(jobCode)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    });
    if (response.ok) {
      setState("success");
      setValues({});
      return;
    }
    // The route's message says why: a missing required field or a paused/closed job.
    const body = await response.json().catch(() => null);
    setError(typeof body?.error === "string" ? body.error : "Please complete every field and try again.");
    setState("error");
  }

  if (state === "success") {
    return (
      <div className="border border-[color-mix(in oklab, var(--status-accepted) 34%, transparent)] bg-[color-mix(in oklab, var(--status-accepted) 14%, transparent)] p-[var(--space-6)]">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--status-accepted)]">Application received</p>
        <h3 className="mt-[var(--space-3)] text-2xl font-semibold tracking-tight">Thank you for applying.</h3>
        <p className="mt-[var(--space-3)] text-sm leading-6 text-[var(--ink-muted)]">
          Our team will review your information and contact you soon.
        </p>
        <button
          type="button"
          onClick={() => setState("idle")}
          className="mt-[var(--space-6)] text-sm font-semibold text-[var(--foreground)] underline underline-offset-4"
        >
          Submit another application
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-[var(--space-6)]">
      {fields.map((field) => (
        <FieldInput key={field.key} field={field} value={values[field.key] ?? ""} onChange={(value) => update(field.key, value)} />
      ))}
      {state === "error" && (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {error}
        </p>
      )}
      <Button type="submit" disabled={state === "submitting"} size="lg" className="w-full">
        {state === "submitting" ? "Sending application..." : "Submit application"}
      </Button>
    </form>
  );
}
