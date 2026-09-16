"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Spinner } from "@/components/ui/button";
import { IconChevronDown } from "@/components/korosha/icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ALL = "all";

/** The light-blue selection tint marks the checked status. */
const checkedItem = "data-[state=checked]:bg-[var(--accent-tint)] data-[state=checked]:font-medium";

function href(status: string, jobId: number | null) {
  const params = new URLSearchParams();
  if (jobId) params.set("job", String(jobId));
  if (status !== ALL) params.set("status", status);
  const query = params.toString();
  return query ? `/applicants?${query}` : "/applicants";
}

/**
 * Filters the Applicants list to one stage through ?status=, so the server
 * does the filtering and a filtered view can be linked to. Replaces the old
 * Current Status board — same list, one dropdown instead of a column per
 * stage, functions exactly like JobFilter next to it.
 */
export function StatusFilter({
  statuses,
  selectedId,
  jobId,
}: {
  statuses: Array<{ id: number; label: string }>;
  selectedId: number | null;
  jobId: number | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const value = selectedId === null ? ALL : String(selectedId);
  const label = statuses.find((status) => status.id === selectedId)?.label ?? "All statuses";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Filter by status: ${label}`}
        className="ui-button inline-flex h-8 w-56 max-w-full items-center justify-between gap-[var(--space-2)] rounded-full border border-[var(--line)] bg-[var(--surface)] px-[var(--space-3)] text-sm text-[var(--foreground)] hover:border-[var(--line-strong)] data-[state=open]:border-[var(--line-strong)]"
      >
        <span className="min-w-0 truncate">
          <span className="text-[var(--ink-muted)]">Status: </span>
          {label}
        </span>
        {pending ? (
          <Spinner className="text-[var(--ink-muted)]" />
        ) : (
          <IconChevronDown size="1em" className="shrink-0 text-[var(--ink-muted)]" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-56 overflow-y-auto">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => startTransition(() => router.push(href(next, jobId)))}
        >
          <DropdownMenuRadioItem value={ALL} className={checkedItem}>
            All statuses
          </DropdownMenuRadioItem>
          {statuses.map((status) => (
            <DropdownMenuRadioItem key={status.id} value={String(status.id)} className={checkedItem}>
              {status.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
