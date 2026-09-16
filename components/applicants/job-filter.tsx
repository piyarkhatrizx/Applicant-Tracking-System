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

/** The light-blue selection tint marks the checked job. */
const checkedItem = "data-[state=checked]:bg-[var(--accent-tint)] data-[state=checked]:font-medium";

function href(job: string, statusId: number | null) {
  const params = new URLSearchParams();
  if (job !== ALL) params.set("job", job);
  if (statusId) params.set("status", String(statusId));
  const query = params.toString();
  return query ? `/applicants?${query}` : "/applicants";
}

/**
 * Filters the Applicants list to one job posting through ?job=, so the server
 * does the filtering and a filtered view can be linked to.
 */
export function JobFilter({
  jobs,
  selectedId,
  statusId,
}: {
  jobs: Array<{ id: number; title: string; code: string }>;
  selectedId: number | null;
  statusId: number | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const value = selectedId === null ? ALL : String(selectedId);
  const label = jobs.find((job) => job.id === selectedId)?.title ?? "All jobs";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Filter by job posting: ${label}`}
        className="ui-button inline-flex h-8 w-72 max-w-full items-center justify-between gap-[var(--space-2)] rounded-full border border-[var(--line)] bg-[var(--surface)] px-[var(--space-3)] text-sm text-[var(--foreground)] hover:border-[var(--line-strong)] data-[state=open]:border-[var(--line-strong)]"
      >
        <span className="min-w-0 truncate">
          <span className="text-[var(--ink-muted)]">Job: </span>
          {label}
        </span>
        {pending ? (
          <Spinner className="text-[var(--ink-muted)]" />
        ) : (
          <IconChevronDown size="1em" className="shrink-0 text-[var(--ink-muted)]" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-72 overflow-y-auto">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => startTransition(() => router.push(href(next, statusId)))}
        >
          <DropdownMenuRadioItem value={ALL} className={checkedItem}>
            All jobs
          </DropdownMenuRadioItem>
          {jobs.map((job) => (
            <DropdownMenuRadioItem key={job.id} value={String(job.id)} className={checkedItem}>
              <span className="min-w-0 truncate">{job.title}</span>
              <span className="ml-auto pl-[var(--space-2)] font-mono text-2xs text-[var(--ink-faint)]">
                {job.code}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
