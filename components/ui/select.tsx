import type { SelectHTMLAttributes } from "react";
import { Field, controlClass, describedBy } from "./field";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  hint?: string;
  error?: string;
  fieldClassName?: string;
};

/**
 * The native select on purpose: it is keyboard- and screen-reader-correct for
 * free, opens as a platform menu, and type-ahead already works. Use the
 * DropdownMenu only when the options need custom rendering (see StatusSelect).
 */
export function Select({
  label,
  hint,
  error,
  children,
  className = "",
  fieldClassName = "",
  id,
  ...props
}: SelectProps) {
  const selectId = id ?? props.name;

  return (
    <Field
      id={selectId}
      label={label}
      hint={hint}
      error={error}
      required={props.required}
      disabled={props.disabled}
      className={fieldClassName}
    >
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(selectId, hint, error)}
        className={`${controlClass(Boolean(error))} pr-[var(--space-6)] ${className}`}
        {...props}
      >
        {children}
      </select>
    </Field>
  );
}
