import type { ReactNode, TextareaHTMLAttributes } from "react";

/**
 * Shared label / hint / error scaffolding for form controls.
 *
 * These stay server-renderable, so ids come from an explicit `id` or the
 * control's `name` rather than `useId`. Without either we skip aria-describedby
 * instead of pointing at an id that does not exist.
 */
export function fieldIds(id: string | undefined) {
  return {
    hintId: id ? `${id}-hint` : undefined,
    errorId: id ? `${id}-error` : undefined,
  };
}

export function describedBy(id: string | undefined, hint?: string, error?: string) {
  const { hintId, errorId } = fieldIds(id);
  return [error ? errorId : hint ? hintId : undefined].filter(Boolean).join(" ") || undefined;
}

/** Border, background and focus treatment shared by input, select and textarea. */
export function controlClass(error: boolean, multiline = false) {
  return [
    `block ${multiline ? "resize-y py-[var(--space-1)]" : "h-8"} w-full border bg-[var(--surface)] px-[var(--space-2)] text-sm font-normal text-[var(--foreground)]`,
    "transition-[border-color] duration-150 ease-[var(--k-ease-out)] placeholder:text-[var(--ink-muted)]",
    "focus:border-[var(--accent)]",
    "disabled:cursor-not-allowed disabled:bg-[var(--surface-sunken)] disabled:text-[var(--ink-muted)]",
    error ? "border-[var(--danger)]" : "border-[var(--line)]",
  ].join(" ");
}

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  hint?: string;
  error?: string;
  fieldClassName?: string;
};

/** A multi-line control with exactly the input's border and focus treatment. */
export function Textarea({ label, hint, error, className = "", fieldClassName = "", id, ...props }: TextareaProps) {
  const textareaId = id ?? props.name;

  return (
    <Field
      id={textareaId}
      label={label}
      hint={hint}
      error={error}
      required={props.required}
      disabled={props.disabled}
      className={fieldClassName}
    >
      <textarea
        id={textareaId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(textareaId, hint, error)}
        className={`${controlClass(Boolean(error), true)} ${className}`}
        {...props}
      />
    </Field>
  );
}

export function Field({
  id,
  label,
  hint,
  error,
  required,
  disabled,
  children,
  className = "",
}: {
  id?: string;
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const { hintId, errorId } = fieldIds(id);

  return (
    <div className={`min-w-0 ${disabled ? "opacity-60" : ""} ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className="mb-[var(--space-1)] block text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]"
        >
          {label}
          {required && (
            <span className="ml-[var(--space-1)] text-[var(--danger)]" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {children}
      {error ? (
        <p id={errorId} role="alert" className="mt-[var(--space-1)] text-xs text-[var(--danger)]">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-[var(--space-1)] text-xs text-[var(--ink-muted)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
