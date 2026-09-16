"use client";

import { useState, useTransition } from "react";
import {
  createStatus,
  deleteStatus,
  reorderStatuses,
  updateStatus,
} from "@/app/actions/statuses";
import { GlassCard, GlassCardHeader } from "@/components/korosha/glass-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill, STATUS_COLOR_TOKENS } from "@/components/korosha/status-pill";
import { IconChevronDown, IconChevronUp, IconGrip, IconTrash } from "@/components/korosha/icon";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { COUNTS_AS_VALUES, countsAsLabel, type StatusCountsAs } from "@/lib/status-counts-as";

export type EditableStatus = {
  id: number;
  key: string;
  label: string;
  color: string;
  order: number;
  isTerminal: boolean;
  active: boolean;
  countsAs: StatusCountsAs;
  applicationCount: number;
};

function ColorPicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (next: string) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-[var(--space-1)]" role="radiogroup" aria-label={label}>
      {STATUS_COLOR_TOKENS.map((token) => (
        <button
          key={token}
          type="button"
          role="radio"
          aria-checked={value === token}
          aria-label={token.replace("--status-", "")}
          onClick={() => onChange(token)}
          className={`h-5 w-5 rounded-full border-2 ${
            value === token ? "border-[var(--foreground)]" : "border-transparent"
          }`}
          style={{ backgroundColor: `var(${token})` }}
        />
      ))}
    </div>
  );
}

export function StatusesEditor({ initial }: { initial: EditableStatus[] }) {
  const [statuses, setStatuses] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState<string>("--status-open");
  const [newCountsAs, setNewCountsAs] = useState<StatusCountsAs>("OPEN");

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(success);
      else toast.error(result.error);
    });
  }

  /** Optimistic locally so the list does not jump, then persisted. */
  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= statuses.length) return;
    const next = [...statuses];
    [next[index], next[target]] = [next[target], next[index]];
    setStatuses(next);
    run(() => reorderStatuses(next.map((status) => status.id)), "Order saved");
  }

  return (
    <div className="space-y-[var(--space-5)]">
      <GlassCard>
        <GlassCardHeader
          title="Add a status"
          description="Colors come from the palette so a new status cannot fail contrast."
        />
        <div className="flex flex-wrap items-end gap-[var(--space-3)]">
          <Input
            label="Name"
            value={newLabel}
            onChange={(event) => setNewLabel(event.target.value)}
            placeholder="Awaiting documents"
            fieldClassName="min-w-52"
          />
          <div>
            <span className="mb-[var(--space-1)] block text-sm font-medium">Color</span>
            <ColorPicker value={newColor} onChange={setNewColor} label="New status color" />
          </div>
          <Select
            label="Counts as"
            value={newCountsAs}
            onChange={(event) => setNewCountsAs(event.target.value as StatusCountsAs)}
          >
            {COUNTS_AS_VALUES.map((value) => (
              <option key={value} value={value}>
                {countsAsLabel[value]}
              </option>
            ))}
          </Select>
          <Button
            variant="primary"
            loading={pending}
            disabled={!newLabel.trim()}
            onClick={() =>
              run(async () => {
                const result = await createStatus({
                  label: newLabel,
                  color: newColor,
                  countsAs: newCountsAs,
                  isTerminal: newCountsAs !== "OPEN",
                });
                if (result.ok) setNewLabel("");
                return result;
              }, "Status added")
            }
          >
            Add status
          </Button>
        </div>
      </GlassCard>

      {statuses.length === 0 ? (
        <EmptyState title="No statuses" description="Run npm run seed to restore the defaults." />
      ) : (
        <GlassCard padded={false}>
          <ul>
            {statuses.map((status, index) => (
              <li
                key={status.id}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-x-[var(--space-3)] gap-y-[var(--space-2)] border-b border-[var(--line)] px-[var(--space-3)] py-[var(--space-2)] last:border-0 lg:grid-cols-[auto_minmax(0,1fr)_auto_auto_auto_auto_auto]"
              >
                <div className="flex shrink-0 items-center gap-[var(--space-1)] text-[var(--ink-faint)]">
                  <IconGrip size={14} />
                  <div className="flex flex-col">
                    <button
                      type="button"
                      aria-label={`Move ${status.label} up`}
                      disabled={index === 0 || pending}
                      onClick={() => move(index, -1)}
                      className="ui-button flex h-3.5 w-4 items-center justify-center rounded-[2px] text-[var(--ink-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] disabled:opacity-25"
                    >
                      <IconChevronUp size={12} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${status.label} down`}
                      disabled={index === statuses.length - 1 || pending}
                      onClick={() => move(index, 1)}
                      className="ui-button flex h-3.5 w-4 items-center justify-center rounded-[2px] text-[var(--ink-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] disabled:opacity-25"
                    >
                      <IconChevronDown size={12} />
                    </button>
                  </div>
                </div>

                <input
                  aria-label={`Rename ${status.label}`}
                  defaultValue={status.label}
                  onBlur={(event) => {
                    const label = event.target.value.trim();
                    if (!label || label === status.label) return;
                    run(() => updateStatus({ id: status.id, label }), "Renamed");
                  }}
                  className="min-w-0 rounded-[4px] border border-transparent bg-transparent px-[var(--space-2)] py-[var(--space-1)] text-sm font-medium text-[var(--foreground)] hover:border-[var(--line)] focus:border-[var(--accent-line)] focus:outline-none"
                />

                <StatusPill color={status.color} label={status.label} />

                <ColorPicker
                  value={status.color}
                  label={`${status.label} color`}
                  onChange={(color) => run(() => updateStatus({ id: status.id, color }), "Recolored")}
                />

                <select
                  aria-label={`${status.label} counts as`}
                  defaultValue={status.countsAs}
                  onChange={(event) =>
                    run(
                      () =>
                        updateStatus({
                          id: status.id,
                          countsAs: event.target.value as StatusCountsAs,
                        }),
                      "Saved",
                    )
                  }
                  className="rounded-[4px] border border-[var(--line)] bg-[var(--surface-sunken)] px-[var(--space-2)] py-[var(--space-1)] text-xs text-[var(--foreground)]"
                >
                  {COUNTS_AS_VALUES.map((value) => (
                    <option key={value} value={value}>
                      {countsAsLabel[value]}
                    </option>
                  ))}
                </select>

                <label className="flex items-center gap-[var(--space-1)] whitespace-nowrap text-xs text-[var(--ink-muted)]">
                  <input
                    type="checkbox"
                    defaultChecked={status.isTerminal}
                    onChange={(event) =>
                      run(
                        () => updateStatus({ id: status.id, isTerminal: event.target.checked }),
                        "Saved",
                      )
                    }
                  />
                  Terminal
                </label>

                <span className="k-tnum w-14 text-right text-xs text-[var(--ink-muted)]">
                  {status.applicationCount} app{status.applicationCount === 1 ? "" : "s"}
                </span>

                <Button
                  size="sm"
                  variant={status.active ? "secondary" : "primary"}
                  onClick={() =>
                    run(
                      () => updateStatus({ id: status.id, active: !status.active }),
                      status.active ? "Deactivated" : "Reactivated",
                    )
                  }
                >
                  {status.active ? "Deactivate" : "Reactivate"}
                </Button>

                <Button
                  size="sm"
                  variant="danger"
                  aria-label={`Delete ${status.label}`}
                  title={
                    status.applicationCount > 0
                      ? "Reassign its applications first, or deactivate it instead"
                      : undefined
                  }
                  onClick={() =>
                    run(async () => {
                      const result = await deleteStatus({ id: status.id });
                      if (result.ok) {
                        setStatuses((current) => current.filter((s) => s.id !== status.id));
                      }
                      return result;
                    }, "Deleted")
                  }
                >
                  <IconTrash size={13} />
                  <span className="sr-only">Delete {status.label}</span>
                </Button>
              </li>
            ))}
          </ul>
        </GlassCard>
      )}
    </div>
  );
}
