import type { InputHTMLAttributes } from "react";
import { Field, controlClass, describedBy } from "./field";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
  fieldClassName?: string;
};

export function Input({
  label,
  hint,
  error,
  className = "",
  fieldClassName = "",
  id,
  ...props
}: InputProps) {
  const inputId = id ?? props.name;

  return (
    <Field
      id={inputId}
      label={label}
      hint={hint}
      error={error}
      required={props.required}
      disabled={props.disabled}
      className={fieldClassName}
    >
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(inputId, hint, error)}
        className={`${controlClass(Boolean(error))} ${className}`}
        {...props}
      />
    </Field>
  );
}
