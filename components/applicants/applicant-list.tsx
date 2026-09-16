"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type MouseEvent } from "react";
import { addNote, archiveApplication, deleteApplication } from "@/app/actions/activity";
import { ApplicationStatusCell } from "@/components/application-status-cell";
import { SimulatedCallModal } from "@/components/calls/simulated-call-modal";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { IconMore, IconNote, IconPhone } from "@/components/korosha/icon";
import type { StatusOption } from "@/components/korosha/status-select";
import { Avatar } from "@/components/ui/avatar";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/field";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";
import { isCallDisabled } from "@/lib/activity/call";

export type ApplicantRowData = {
  applicationId: number;
  candidateId: number;
  name: string;
  phone: string | null;
  source: string;
  statusId: number;
  applied: string;
};

/**
 * One column template for the header and every row, so the columns line up.
 * Sizes are fixed, never auto: each row is its own grid, and auto would size
 * each row differently. Below md, Source and Applied drop out of both, and the
 * fixed columns shrink so a 390px phone still leaves the name room: a smaller
 * avatar, a narrower status, and an icon-only Call button.
 */
const GRID =
  "grid grid-cols-[1.75rem_minmax(0,1fr)_7.25rem_1.75rem_2rem_1.75rem] items-center gap-x-[var(--space-2)] md:grid-cols-[2.5rem_minmax(0,1.5fr)_minmax(0,1fr)_10rem_2.5rem_5.5rem_4.75rem_6.5rem] md:gap-x-[var(--space-3)]";

/**
 * A click on a control must not also open the profile. React bubbles events
 * through portals, so this also catches clicks inside the dropdown menus.
 */
const stop = (event: MouseEvent) => event.stopPropagation();

export function ApplicantList({
  applicants,
  statuses,
}: {
  applicants: ApplicantRowData[];
  statuses: StatusOption[];
}) {
  const router = useRouter();
  const [calling, setCalling] = useState<ApplicantRowData | null>(null);
  const [noting, setNoting] = useState<ApplicantRowData | null>(null);
  const [deleting, setDeleting] = useState<ApplicantRowData | null>(null);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  function moveToHistory(applicant: ApplicantRowData) {
    startTransition(async () => {
      const result = await archiveApplication(applicant.applicationId);
      if (result.ok) toast.success(`${applicant.name} moved to History`);
      else toast.error(result.error);
    });
  }

  function saveNote() {
    const target = noting;
    if (!target) return;
    startTransition(async () => {
      const result = await addNote({ candidateId: target.candidateId, applicationId: target.applicationId, body: note });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Note added");
      setNote("");
      setNoting(null);
    });
  }

  function confirmDelete() {
    const target = deleting;
    if (!target) return;
    startTransition(async () => {
      const result = await deleteApplication(target.applicationId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${target.name} deleted`);
      setDeleting(null);
    });
  }

  if (!applicants.length) {
    return <EmptyState title="No applicants" description="No active applicants match this job posting." />;
  }

  return (
    <>
      <div
        aria-hidden="true"
        className={`${GRID} border border-transparent px-[var(--space-2)] pb-[var(--space-2)] text-2xs font-medium uppercase tracking-wide text-[var(--ink-faint)]`}
      >
        <span className="col-span-2">Applicant Name</span>
        <span className="hidden md:block">Source</span>
        <span>Status</span>
        <span className="text-center">Note</span>
        <span className="hidden text-right md:block">Applied</span>
        <span className="text-center">Call</span>
        <span className="hidden whitespace-nowrap text-right md:block">Other Actions</span>
      </div>

      <ul aria-label="Applicants" className="space-y-[var(--space-2)]">
        {applicants.map((applicant) => {
          const profile = `/candidates/${applicant.candidateId}`;
          const noPhone = isCallDisabled(applicant.phone);
          return (
            <li
              key={applicant.applicationId}
              // The name is the keyboard path to the profile; the whole row is the pointer shortcut.
              onClick={() => router.push(profile)}
              className={`${GRID} cursor-pointer rounded-full border border-[var(--line)] bg-[var(--surface)] px-[var(--space-2)] py-[var(--space-1)] hover:border-[var(--line-strong)] hover:bg-[var(--surface-hover)]`}
            >
              <span aria-hidden="true" className="flex">
                <Avatar name={applicant.name} size="md" className="md:h-10 md:w-10 md:text-sm" />
              </span>
              <Link
                href={profile}
                onClick={stop}
                className="truncate text-sm font-medium text-[var(--foreground)] hover:underline"
              >
                {applicant.name}
              </Link>
              <span className="hidden truncate text-sm text-[var(--ink-muted)] md:block">
                {applicant.source}
              </span>
              <span onClick={stop} className="min-w-0">
                <ApplicationStatusCell applicationId={applicant.applicationId} statusId={applicant.statusId} statuses={statuses} />
              </span>
              <span onClick={stop} className="flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setNote("");
                    setNoting(applicant);
                  }}
                  aria-label={`Add note about ${applicant.name}`}
                  title="Add note"
                  className="ui-button inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-muted)] hover:border-[var(--line-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                >
                  <IconNote size={13} />
                </button>
              </span>
              <span className="k-tnum hidden text-right text-sm text-[var(--ink-muted)] md:block">
                {applicant.applied}
              </span>
              <span onClick={stop} className="flex justify-center">
                <button
                  type="button"
                  disabled={noPhone}
                  onClick={() => setCalling(applicant)}
                  aria-label={`Call ${applicant.name}`}
                  title={noPhone ? "No phone number on file" : `Call ${applicant.name} (simulated)`}
                  className="ui-button inline-flex h-7 w-7 items-center justify-center gap-1 rounded-full border border-[var(--line)] bg-[var(--surface)] text-xs font-medium text-[var(--foreground)] hover:border-[var(--line-strong)] hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[var(--line)] disabled:hover:bg-[var(--surface)] md:w-auto md:px-[var(--space-3)]"
                >
                  <IconPhone size={11} />
                  {/* Icon-only on phones; the label returns from md up. */}
                  <span className="hidden md:inline">Call</span>
                </button>
              </span>
              <span onClick={stop} className="flex justify-end">
                {/* Non-modal, so opening a dialog from an item never leaves the page locked. */}
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger
                    aria-label={`More actions for ${applicant.name}`}
                    className="ui-button inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--ink-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] data-[state=open]:bg-[var(--surface-hover)] data-[state=open]:text-[var(--foreground)]"
                  >
                    <IconMore size={14} />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => router.push(profile)}>View profile</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => moveToHistory(applicant)}>Move to History</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem destructive onSelect={() => setDeleting(applicant)}>
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </span>
            </li>
          );
        })}
      </ul>

      <SimulatedCallModal
        applicant={calling && { applicationId: calling.applicationId, name: calling.name, phone: calling.phone }}
        open={calling !== null}
        onOpenChange={(open) => {
          if (!open) setCalling(null);
        }}
      />

      <Dialog
        open={noting !== null}
        onOpenChange={(open) => {
          if (!open) setNoting(null);
        }}
        title={noting ? `Add a note about ${noting.name}` : "Add a note"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setNoting(null)}>Cancel</Button>
            <Button variant="primary" loading={pending} disabled={!note.trim()} onClick={saveNote}>
              Add note
            </Button>
          </>
        }
      >
        <label htmlFor="applicant-note" className="sr-only">
          Note
        </label>
        <Textarea
          id="applicant-note"
          rows={4}
          maxLength={10_000}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="What happened with this applicant?"
        />
      </Dialog>

      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Delete applicant?"
        description={
          deleting
            ? `This permanently removes ${deleting.name}'s application, with its notes, calls and activity, and takes it out of analytics. It cannot be undone. To keep the record, move it to History instead.`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="danger" loading={pending} onClick={confirmDelete}>
              Delete permanently
            </Button>
          </>
        }
      />
    </>
  );
}
