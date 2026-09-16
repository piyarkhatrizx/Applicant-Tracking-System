import { Slot } from "@radix-ui/react-slot";
import type { ButtonHTMLAttributes } from "react";

/**
 * The one button. Merged from the old ui and korosha buttons, so every variant
 * either of them offered is here, under one set of names:
 *   primary      near-black fill (was ui "primary" and korosha "accent")
 *   secondary    hairline on surface (was ui "secondary" and korosha "ghost")
 *   ghost        no border, no fill until hover
 *   destructive  solid danger fill
 *   danger       soft danger: tinted, for a reversible-looking destructive row action
 *   icon         square, muted, for icon-only controls; give it an aria-label
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive" | "danger" | "icon";
export type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary:
    "border-transparent bg-[var(--primary)] text-[var(--on-primary)] hover:bg-[var(--primary-hover)]",
  secondary:
    "border-[var(--line)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--line-strong)] hover:bg-[var(--surface-hover)]",
  ghost:
    "border-transparent bg-transparent text-[var(--foreground)] hover:bg-[var(--surface-hover)]",
  destructive:
    "border-transparent bg-[var(--danger)] text-[var(--on-primary)] hover:bg-[var(--danger-strong)]",
  danger:
    "border-[var(--line)] bg-[var(--danger-tint)] text-[var(--danger-strong)] hover:border-[var(--danger)] hover:bg-[var(--surface-hover)]",
  icon: "border-transparent bg-transparent text-[var(--ink-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
};

// Dense tool: md is 32px, not the 40px a marketing site would use.
const sizes: Record<ButtonSize, string> = {
  sm: "h-7 gap-[var(--space-1)] px-[var(--space-2)] text-xs",
  md: "h-8 gap-[var(--space-2)] px-[var(--space-3)] text-sm",
  lg: "h-10 gap-[var(--space-2)] px-[var(--space-4)] text-sm",
};

/** Square, so an icon sits centered rather than in a pill. */
const iconSizes: Record<ButtonSize, string> = {
  sm: "h-7 w-7",
  md: "h-8 w-8",
  lg: "h-10 w-10",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /**
   * Render the child element (a <Link> or <a>) with button styling instead of
   * a <button>. Without this, pages copy-paste the class string onto anchors
   * and the two drift apart.
   */
  asChild?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  asChild = false,
  disabled,
  className = "",
  children,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";
  const shape = variant === "icon" ? iconSizes[size] : sizes[size];

  return (
    <Component
      className={`ui-button inline-flex shrink-0 items-center justify-center border font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${shape} ${className}`}
      disabled={asChild ? undefined : disabled || loading}
      aria-disabled={asChild && (disabled || loading) ? true : undefined}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && <Spinner />}
          {children}
        </>
      )}
    </Component>
  );
}

/**
 * A fast spinner reads as a fast app. 600ms per turn, not the 1s default.
 * Sized in em so it tracks the button's own text size.
 */
export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-[1em] w-[1em] shrink-0 animate-spin rounded-full border-[1.5px] border-current border-t-transparent opacity-70 [animation-duration:600ms] ${className}`}
    />
  );
}
