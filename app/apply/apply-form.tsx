"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type FormState = {
  isAtLeast18: string;
  isCpaCertified: string;
  patientUsesMedicare: string;
  caregivingInterest: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
};

const initialState: FormState = {
  isAtLeast18: "",
  isCpaCertified: "",
  patientUsesMedicare: "",
  caregivingInterest: "",
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
};

function Question({ label, name, value, onChange, required = true }: { label: string; name: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return <fieldset className="border-0 p-0"><legend className="text-sm font-medium">{label} ({required ? "required" : "optional"})</legend><div className="mt-[var(--space-3)] flex gap-[var(--space-2)]">{["Yes", "No"].map((option) => <label key={option} className={`cursor-pointer border px-[var(--space-4)] py-[var(--space-2)] text-sm transition-colors ${value === option.toLowerCase() ? "border-[var(--accent)] bg-[var(--surface-selected)] text-[var(--foreground)]" : "border-[var(--line)] hover:border-[var(--line-strong)]"}`}><input className="sr-only" type="radio" name={name} value={option.toLowerCase()} checked={value === option.toLowerCase()} onChange={(event) => onChange(event.target.value)} required={required} />{option}</label>)}</div></fieldset>;
}

export default function ApplyForm({ jobCode }: { jobCode: string }) {
  const [form, setForm] = useState(initialState);
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [error, setError] = useState("");

  function update(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("submitting");
    const response = await fetch("/api/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, job: jobCode, isAtLeast18: form.isAtLeast18 === "yes", isCpaCertified: form.isCpaCertified ? form.isCpaCertified === "yes" : null, patientUsesMedicare: form.patientUsesMedicare === "yes" }) });
    if (response.ok) {
      setState("success");
      setForm(initialState);
      return;
    }
    // The route's message says why: a paused or closed job, or a field to fix.
    const body = await response.json().catch(() => null);
    setError(typeof body?.error === "string" ? body.error : "Please complete every field and try again.");
    setState("error");
  }

  if (state === "success") return <div className="border border-[color-mix(in oklab, var(--status-accepted) 34%, transparent)] bg-[color-mix(in oklab, var(--status-accepted) 14%, transparent)] p-[var(--space-6)]"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--status-accepted)]">Application received</p><h3 className="mt-[var(--space-3)] text-2xl font-semibold tracking-tight">Thank you for applying.</h3><p className="mt-[var(--space-3)] text-sm leading-6 text-[var(--ink-muted)]">Our care team will review your information and contact you soon.</p><button type="button" onClick={() => setState("idle")} className="mt-[var(--space-6)] text-sm font-semibold text-[var(--foreground)] underline underline-offset-4">Submit another application</button></div>;

  return <form onSubmit={submit} className="space-y-[var(--space-8)]">
    <div className="grid gap-[var(--space-6)] sm:grid-cols-2">
      <Question label="Are you 18 or older?" name="isAtLeast18" value={form.isAtLeast18} onChange={(value) => update("isAtLeast18", value)} />
      <Question label="Are you CPA certified? (optional)" name="isCpaCertified" value={form.isCpaCertified} onChange={(value) => update("isCpaCertified", value)} required={false} />
      <Question label="Is your current patient under Medicare?" name="patientUsesMedicare" value={form.patientUsesMedicare} onChange={(value) => update("patientUsesMedicare", value)} />
    </div>
    <fieldset className="border-0 p-0"><legend className="text-sm font-medium">Which opportunity describes you? (required)</legend><div className="mt-[var(--space-3)] grid gap-[var(--space-2)]"><label className={`border px-[var(--space-4)] py-[var(--space-3)] text-sm ${form.caregivingInterest === "GENERAL_CAREGIVER" ? "border-[var(--accent)] bg-[var(--surface-selected)]" : "border-[var(--line)]"}`}><input className="mr-[var(--space-3)] accent-[var(--accent)]" type="radio" name="caregivingInterest" value="GENERAL_CAREGIVER" checked={form.caregivingInterest === "GENERAL_CAREGIVER"} onChange={(event) => update("caregivingInterest", event.target.value)} required />I am looking for a general caregiver position</label><label className={`border px-[var(--space-4)] py-[var(--space-3)] text-sm ${form.caregivingInterest === "CURRENTLY_CARING_FOR_PATIENT" ? "border-[var(--accent)] bg-[var(--surface-selected)]" : "border-[var(--line)]"}`}><input className="mr-[var(--space-3)] accent-[var(--accent)]" type="radio" name="caregivingInterest" value="CURRENTLY_CARING_FOR_PATIENT" checked={form.caregivingInterest === "CURRENTLY_CARING_FOR_PATIENT"} onChange={(event) => update("caregivingInterest", event.target.value)} />I am already caring for a patient</label></div></fieldset>
    <div className="grid gap-[var(--space-5)] sm:grid-cols-2"><Input label="First name" name="firstName" required value={form.firstName} onChange={(event) => update("firstName", event.target.value)} /><Input label="Last name" name="lastName" required value={form.lastName} onChange={(event) => update("lastName", event.target.value)} /><Input label="Phone number" name="phone" required type="tel" value={form.phone} onChange={(event) => update("phone", event.target.value)} /><Input label="Email" name="email" required type="email" value={form.email} onChange={(event) => update("email", event.target.value)} /></div>
    {state === "error" && <p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}
    <Button type="submit" disabled={state === "submitting"} size="lg" className="w-full">{state === "submitting" ? "Sending application..." : "Submit application"}</Button>
  </form>;
}