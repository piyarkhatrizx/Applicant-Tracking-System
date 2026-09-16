"use client";

import { useState, useTransition } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/button";
import { IconChevronDown } from "./icon";
import { StatusPill } from "./status-pill";

export type StatusOption = {
  id: number;
  label: string;
  color: string;
  isTerminal: boolean;
};

export type StatusChangeResult = { ok: true } | { ok: false; error: string };

/**
 * Moves one application between stages, which are rows in the Status table
 * rather than enum members — so the options come from the database and a
 * recruiter can add, rename or reorder them without a deploy.
 *
 * `onChange` reports failure by RETURNING `{ ok: false, error }`, not throwing.
 * A convention where the caller must remember to throw gets forgotten exactly
 * once, and a failed status change then renders as a successful one.
 */
export function KStatusSelect({
  value,
  options,
  onChange,
  disabled = false,
  align = "start",
  label = "Stage",
}: {
  /** Current Status id. */
  value: number;
  options: StatusOption[];
  onChange?: (nextStatusId: number) => Promise<StatusChangeResult | void> | StatusChangeResult | void;
  disabled?: boolean;
  align?: "start" | "end";
  label?: string;
}) {
  const [optimistic, setOptimistic] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const current = optimistic ?? value;

  const open = options.filter((option) => !option.isTerminal);
  // Closing stages sit below a separator so they are never a slip away.
  const terminal = options.filter((option) => option.isTerminal);
  const currentOption = options.find((option) => option.id === current);

  function select(nextId: number) {
    if (nextId === current) return;
    const previous = current;
    const next = options.find((option) => option.id === nextId);
    setOptimistic(nextId);

    startTransition(async () => {
      const fail = (message: string) => {
        setOptimistic(previous);
        toast.error(message, { action: { label: "Retry", onClick: () => select(nextId) } });
      };

      try {
        const result = await onChange?.(nextId);
        if (result && result.ok === false) {
          fail(result.error || `Could not move to ${next?.label ?? "that stage"}`);
          return;
        }
        setOptimistic(null);
      } catch {
        fail(`Could not move to ${next?.label ?? "that stage"}`);
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled || pending}
        aria-label={`${label}: ${currentOption?.label ?? "Unknown"}`}
        className="ui-button inline-flex h-7 items-center gap-[var(--space-1)] border border-transparent px-[var(--space-1)] hover:border-[var(--line)] hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <StatusPill color={currentOption?.color} label={currentOption?.label ?? "Unknown"} />
        {pending ? (
          <Spinner className="text-[var(--ink-muted)]" />
        ) : (
          <IconChevronDown size="1em" className="shrink-0 text-xs text-[var(--ink-muted)]" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align}>
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        {/* Radix radio values are strings; ids are numbers everywhere else. */}
        <DropdownMenuRadioGroup value={String(current)} onValueChange={(value) => select(Number(value))}>
          {open.map((option) => (
            <DropdownMenuRadioItem key={option.id} value={String(option.id)}>
              <StatusPill color={option.color} label={option.label} />
            </DropdownMenuRadioItem>
          ))}
          {terminal.length > 0 && <DropdownMenuSeparator />}
          {terminal.map((option) => (
            <DropdownMenuRadioItem key={option.id} value={String(option.id)}>
              <StatusPill color={option.color} label={option.label} />
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
