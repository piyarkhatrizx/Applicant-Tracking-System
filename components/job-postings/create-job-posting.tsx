"use client";

import { useId, useState, type FormEvent } from "react";
import { createJobPosting, type JobFieldInput } from "@/app/actions/jobs";
import { FieldInput } from "@/components/apply/field-inputs";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import type { JobFieldType } from "@/lib/data";

type Status = "OPEN" | "CLOSED";
type Step = 1 | 2 | 3;

const DETAILS_EMPTY = { title: "", location: "", description: "", status: "OPEN" as Status };
const BUILT_INS_EMPTY = { name: true, email: true, phone: true };

type CustomFieldDraft = {
  id: string;
  label: string;
  type: JobFieldType;
  options: string;
  required: boolean;
};

const TYPE_LABEL: Record<JobFieldType, string> = { TEXT: "Text", YES_NO: "Yes / No", SELECT: "Dropdown" };

function slugify(label: string) {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "field";
}

/** Turns the modal's state into the field list the server action expects. */
function buildFields(builtIns: typeof BUILT_INS_EMPTY, customs: CustomFieldDraft[]): JobFieldInput[] {
  const fields: JobFieldInput[] = [];
  if (builtIns.name) fields.push({ key: "first_name", label: "Name", type: "TEXT", options: [], required: false });
  if (builtIns.email) fields.push({ key: "email", label: "Email", type: "TEXT", options: [], required: true });
  if (builtIns.phone) fields.push({ key: "phone", label: "Phone", type: "TEXT", options: [], required: true });

  const seen = new Set(fields.map((field) => field.key));
  for (const draft of customs) {
    const label = draft.label.trim();
    if (!label) continue;
    let key = `custom_${slugify(label)}`;
    let suffix = 2;
    while (seen.has(key)) key = `custom_${slugify(label)}_${suffix++}`;
    seen.add(key);
    const options = draft.type === "SELECT" ? draft.options.split(",").map((o) => o.trim()).filter(Boolean) : [];
    fields.push({ key, label, type: draft.type, options, required: draft.required });
  }
  return fields;
}

function nextCode(jobCount: number) {
  return `CARE-${String(jobCount + 1).padStart(3, "0")}`;
}

/** The "Create new job board" button and the multi-step modal it opens: details, then the apply-page field builder, then a preview. */
export function CreateJobPosting({ jobCount = 0 }: { jobCount?: number }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [details, setDetails] = useState(DETAILS_EMPTY);
  const [builtIns, setBuiltIns] = useState(BUILT_INS_EMPTY);
  const [customs, setCustoms] = useState<CustomFieldDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const draftId = useId();

  const updateDetails = (field: keyof typeof DETAILS_EMPTY, value: string) =>
    setDetails((current) => ({ ...current, [field]: value }));

  function addCustomField() {
    setCustoms((current) => [
      ...current,
      { id: `${draftId}-${current.length}-${Date.now()}`, label: "", type: "TEXT", options: "", required: false },
    ]);
  }

  function updateCustomField(id: string, patch: Partial<CustomFieldDraft>) {
    setCustoms((current) => current.map((field) => (field.id === id ? { ...field, ...patch } : field)));
  }

  function removeCustomField(id: string) {
    setCustoms((current) => current.filter((field) => field.id !== id));
  }

  function reset() {
    setStep(1);
    setDetails(DETAILS_EMPTY);
    setBuiltIns(BUILT_INS_EMPTY);
    setCustoms([]);
    setError(null);
  }

  const fields = buildFields(builtIns, customs);
  const hasDedupeField = builtIns.email || builtIns.phone;

  function goToFields(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStep(2);
  }

  function goToPreview() {
    if (!hasDedupeField) {
      setError("Keep email or phone on the apply page — applicants are matched on one of them.");
      return;
    }
    for (const draft of customs) {
      if (draft.type === "SELECT" && draft.label.trim()) {
        const optionCount = draft.options.split(",").map((o) => o.trim()).filter(Boolean).length;
        if (optionCount < 2) {
          setError(`"${draft.label.trim()}" needs at least two comma-separated options.`);
          return;
        }
      }
    }
    setError(null);
    setStep(3);
  }

  async function submit() {
    setError(null);
    setPending(true);
    const result = await createJobPosting({ ...details, fields });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success(`${result.data.title} created as ${result.data.code}`);
    reset();
    setOpen(false);
  }

  const titles: Record<Step, string> = {
    1: "Create new job board",
    2: "Build the apply page",
    3: "Preview & confirm",
  };
  const descriptions: Record<Step, string> = {
    1: "Adds a job posting. An open posting accepts applications right away.",
    2: "Choose which fields the public apply page asks for.",
    3: `This is what applicants will see at /apply/${nextCode(jobCount)}.`,
  };

  return (
    <>
      <Button
        variant="primary"
        className="rounded-full"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        Create new job board
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
        title={titles[step]}
        description={descriptions[step]}
        className="w-[min(92vw,40rem)]"
        footer={
          step === 1 ? (
            <Button variant="primary" type="submit" form={`${draftId}-details`}>
              Next: build apply page
            </Button>
          ) : step === 2 ? (
            <>
              <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
              <Button variant="primary" onClick={goToPreview}>Next: preview</Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setStep(2)}>Back</Button>
              <Button variant="primary" loading={pending} onClick={submit}>Create job posting</Button>
            </>
          )
        }
      >
        {step === 1 && (
          <form id={`${draftId}-details`} onSubmit={goToFields} className="space-y-[var(--space-4)]">
            <Input
              label="Title"
              name="title"
              required
              maxLength={80}
              value={details.title}
              placeholder="Home Health Aide"
              onChange={(event) => updateDetails("title", event.target.value)}
            />
            <Input
              label="Location"
              name="location"
              required
              maxLength={80}
              value={details.location}
              placeholder="Cleveland, OH"
              onChange={(event) => updateDetails("location", event.target.value)}
            />
            <div>
              <label htmlFor="job-description" className="mb-[var(--space-1)] block text-sm font-medium">
                Description
              </label>
              <Textarea
                id="job-description"
                name="description"
                rows={4}
                maxLength={2000}
                value={details.description}
                onChange={(event) => updateDetails("description", event.target.value)}
                placeholder="What the role involves and who it suits."
              />
            </div>
            <fieldset className="border-0 p-0">
              <legend className="text-sm font-medium">Status</legend>
              <div className="mt-[var(--space-2)] flex gap-[var(--space-2)]">
                {(["OPEN", "CLOSED"] as const).map((value) => (
                  <label
                    key={value}
                    className={`cursor-pointer rounded-full border px-[var(--space-3)] py-[var(--space-1)] text-sm ${
                      details.status === value
                        ? "border-[var(--accent-line)] bg-[var(--surface-selected)] font-medium"
                        : "border-[var(--line)] hover:border-[var(--line-strong)]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="status"
                      value={value}
                      checked={details.status === value}
                      onChange={() => updateDetails("status", value)}
                      className="sr-only"
                    />
                    {value === "OPEN" ? "Open" : "Closed"}
                  </label>
                ))}
              </div>
            </fieldset>
          </form>
        )}

        {step === 2 && (
          <div className="space-y-[var(--space-6)]">
            <fieldset className="border-0 p-0">
              <legend className="text-sm font-medium">Built-in fields</legend>
              <div className="mt-[var(--space-2)] space-y-[var(--space-2)]">
                {(
                  [
                    ["name", "Name"],
                    ["email", "Email"],
                    ["phone", "Phone"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-[var(--space-2)] text-sm">
                    <input
                      type="checkbox"
                      className="accent-[var(--accent)]"
                      checked={builtIns[key]}
                      onChange={(event) => setBuiltIns((current) => ({ ...current, [key]: event.target.checked }))}
                    />
                    {label}
                    {(key === "email" || key === "phone") && (
                      <span className="text-xs text-[var(--ink-muted)]">— used to match returning applicants</span>
                    )}
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Custom fields</p>
                <Button variant="secondary" size="sm" type="button" onClick={addCustomField}>
                  Add field
                </Button>
              </div>
              {customs.length === 0 && (
                <p className="mt-[var(--space-2)] text-sm text-[var(--ink-muted)]">
                  No custom fields yet. Add one for anything specific to this role.
                </p>
              )}
              <ul className="mt-[var(--space-3)] space-y-[var(--space-3)]">
                {customs.map((field) => (
                  <li key={field.id} className="rounded-2xl border border-[var(--line)] bg-[var(--surface-sunken)] p-[var(--space-3)]">
                    <div className="grid gap-[var(--space-2)] sm:grid-cols-[1fr_9rem]">
                      <Input
                        label="Label"
                        value={field.label}
                        placeholder="Years of experience"
                        onChange={(event) => updateCustomField(field.id, { label: event.target.value })}
                      />
                      <Select
                        label="Type"
                        value={field.type}
                        onChange={(event) => updateCustomField(field.id, { type: event.target.value as JobFieldType })}
                      >
                        {(Object.keys(TYPE_LABEL) as JobFieldType[]).map((type) => (
                          <option key={type} value={type}>
                            {TYPE_LABEL[type]}
                          </option>
                        ))}
                      </Select>
                    </div>
                    {field.type === "SELECT" && (
                      <Input
                        className="mt-[var(--space-2)]"
                        label="Options (comma-separated)"
                        value={field.options}
                        placeholder="Weekdays, Weekends, Either"
                        onChange={(event) => updateCustomField(field.id, { options: event.target.value })}
                      />
                    )}
                    <div className="mt-[var(--space-2)] flex items-center justify-between">
                      <label className="flex items-center gap-[var(--space-2)] text-sm">
                        <input
                          type="checkbox"
                          className="accent-[var(--accent)]"
                          checked={field.required}
                          onChange={(event) => updateCustomField(field.id, { required: event.target.checked })}
                        />
                        Required
                      </label>
                      <button
                        type="button"
                        onClick={() => removeCustomField(field.id)}
                        className="text-sm font-medium text-[var(--danger)] hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-[var(--space-5)]">
            <div>
              <p className="text-sm font-semibold">{details.title || "Untitled role"}</p>
              <p className="text-sm text-[var(--ink-muted)]">{details.location}</p>
            </div>
            <div className="space-y-[var(--space-4)] rounded-2xl border border-[var(--line)] bg-[var(--surface-sunken)] p-[var(--space-4)]">
              {fields.map((field) => (
                <FieldInput key={field.key} field={field} value="" disabled />
              ))}
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-[var(--space-3)] text-sm text-[var(--danger)]">
            {error}
          </p>
        )}
      </Dialog>
    </>
  );
}
