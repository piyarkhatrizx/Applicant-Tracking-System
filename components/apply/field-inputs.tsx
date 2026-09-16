import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { JobFieldType } from "@/lib/data";

export type FieldSpec = {
  key: string;
  label: string;
  type: JobFieldType;
  options: string[];
  required: boolean;
};

/**
 * Renders one recruiter-configured apply-page question. Shared between the
 * live public apply form (components/apply/dynamic-apply-form.tsx) and the
 * disabled preview in the "Create new job board" modal, so the two can never
 * drift apart on how a field type looks.
 */
export function FieldInput({
  field,
  value,
  onChange,
  disabled = false,
}: {
  field: FieldSpec;
  value: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}) {
  if (field.type === "YES_NO") {
    return (
      <fieldset className="border-0 p-0">
        <legend className="text-sm font-medium">
          {field.label} ({field.required ? "required" : "optional"})
        </legend>
        <div className="mt-[var(--space-3)] flex gap-[var(--space-2)]">
          {["Yes", "No"].map((option) => (
            <label
              key={option}
              className={`cursor-pointer rounded-full border px-[var(--space-4)] py-[var(--space-2)] text-sm transition-colors ${
                value === option.toLowerCase()
                  ? "border-[var(--accent)] bg-[var(--surface-selected)] text-[var(--foreground)]"
                  : "border-[var(--line)] hover:border-[var(--line-strong)]"
              } ${disabled ? "opacity-60" : ""}`}
            >
              <input
                className="sr-only"
                type="radio"
                name={field.key}
                value={option.toLowerCase()}
                checked={value === option.toLowerCase()}
                onChange={(event) => onChange?.(event.target.value)}
                required={field.required}
                disabled={disabled}
              />
              {option}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  if (field.type === "SELECT") {
    return (
      <Select
        label={`${field.label}${field.required ? "" : " (optional)"}`}
        name={field.key}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        required={field.required}
        disabled={disabled}
      >
        <option value="">Select…</option>
        {field.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
    );
  }

  const inputType = field.key === "email" ? "email" : field.key === "phone" ? "tel" : "text";
  return (
    <Input
      label={`${field.label}${field.required ? "" : " (optional)"}`}
      name={field.key}
      type={inputType}
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
      required={field.required}
      disabled={disabled}
    />
  );
}
