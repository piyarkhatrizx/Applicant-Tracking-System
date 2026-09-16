"use client";

import { useCallback, useState } from "react";
import { addNote, archiveApplication, moveApplicationStatus } from "@/app/actions/activity";
import { SimulatedCallModal } from "@/components/calls/simulated-call-modal";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SidePanel, SidePanelField, SidePanelSection } from "@/components/korosha/side-panel";
import { KStatusSelect, type StatusOption } from "@/components/korosha/status-select";
import { StatusPill } from "@/components/korosha/status-pill";
import { Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { LeadHead, LeadRow, type LeadRowData, type LeadSort } from "./lead-row";

/**
 * The inbox.
 *
 * Panel state is local React state, NOT a route. Opening a lead must not lose
 * list position, scroll or filters, and a navigation would lose all three.
 */
export function LeadInbox({
  leads,
  statuses,
  emptyHint,
  sort,
}: {
  leads: LeadRowData[];
  statuses: StatusOption[];
  emptyHint: string;
  sort?: LeadSort;
}) {
  const [openId, setOpenId] = useState<number | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [calling, setCalling] = useState<LeadRowData | null>(null);

  const lead = leads.find((candidate) => candidate.id === openId) ?? null;

  const open = useCallback((id: number) => {
    setOpenId(id);
    setPanelOpen(true);
  }, []);

  async function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>, success: string) {
    setBusy(true);
    try {
      const result = await action();
      if (result.ok) toast.success(success);
      else toast.error(result.error);
      return result.ok;
    } finally {
      setBusy(false);
    }
  }

  function quickNote(target: LeadRowData) {
    const body = window.prompt(`Note about ${target.name}`);
    if (!body?.trim()) return;
    void run(
      () => addNote({ candidateId: target.candidateId, applicationId: target.id, body }),
      "Note added",
    );
  }

  function quickCall(target: LeadRowData) {
    if (target.phone) setCalling(target);
  }

  function email(target: LeadRowData) {
    if (!target.email) {
      toast.error("No email address on file.");
      return;
    }
    window.location.href = `mailto:${target.email}`;
  }

  function reject(target: LeadRowData) {
    const rejected = statuses.find((status) => status.isTerminal);
    if (!rejected) {
      toast.error("No terminal status is configured.");
      return;
    }
    void run(() => moveApplicationStatus(target.id, rejected.id), `Moved to ${rejected.label}`);
  }

  function archive(target: LeadRowData) {
    void run(() => archiveApplication(target.id), `${target.name} moved to History`);
  }

  if (!leads.length) {
    return <EmptyState title="Nothing in this view" description={emptyHint} />;
  }

  return (
    <>
      <SimulatedCallModal
        applicant={calling && { applicationId: calling.id, name: calling.name, phone: calling.phone }}
        open={calling !== null}
        onOpenChange={(open) => {
          if (!open) setCalling(null);
        }}
      />
      <div className="overflow-hidden rounded-[6px] border border-[var(--line)] bg-[var(--surface)]">
        <LeadHead sort={sort} />
        {leads.map((row) => (
          <LeadRow
            key={row.id}
            lead={row}
            selected={openId === row.id && panelOpen}
            onOpen={() => open(row.id)}
            onCall={() => quickCall(row)}
            onNote={() => quickNote(row)}
            onEmail={() => email(row)}
            onArchive={() => archive(row)}
            onReject={() => reject(row)}
          />
        ))}
      </div>

      {lead && (
        <SidePanel
          open={panelOpen}
          onOpenChange={setPanelOpen}
          eyebrow="Lead"
          title={lead.name}
          description={`Applied ${lead.appliedLabel} ago via ${lead.source.toLowerCase().replace("_", " ")}`}
          actions={
            <>
              <Button
                variant="primary"
                size="sm"
                disabled={!lead.phone}
                title={lead.phone ? undefined : "No phone number on file"}
                onClick={() => quickCall(lead)}
              >
                Call
              </Button>
              <KStatusSelect
                value={statuses.find((status) => status.label === lead.statusLabel)?.id ?? statuses[0]?.id ?? 0}
                options={statuses}
                align="start"
                onChange={(nextId) => moveApplicationStatus(lead.id, nextId)}
              />
              <Button variant="secondary" size="sm" loading={busy} onClick={() => archive(lead)}>
                Move to History
              </Button>
            </>
          }
        >
          <SidePanelSection title="Contact">
            <dl>
              <SidePanelField label="Phone">{lead.phone ?? "—"}</SidePanelField>
              <SidePanelField label="Email">{lead.email ?? "—"}</SidePanelField>
              <SidePanelField label="Status">
                <StatusPill color={lead.statusColor} label={lead.statusLabel} />
              </SidePanelField>
              <SidePanelField label="Applied">{lead.appliedLabel} ago</SidePanelField>
              {lead.otherApplications > 0 && (
                <SidePanelField label="Other applications">
                  {lead.otherApplications} other application{lead.otherApplications === 1 ? "" : "s"}
                </SidePanelField>
              )}
            </dl>
          </SidePanelSection>

          <SidePanelSection title="Add a note">
            <Textarea
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="What happened on this lead?"
            />
            <div className="mt-[var(--space-2)] flex justify-end">
              <Button
                size="sm"
                variant="primary"
                loading={busy}
                disabled={!note.trim()}
                onClick={async () => {
                  const ok = await run(
                    () => addNote({ candidateId: lead.candidateId, applicationId: lead.id, body: note }),
                    "Note added",
                  );
                  if (ok) setNote("");
                }}
              >
                Add note
              </Button>
            </div>
          </SidePanelSection>

          <SidePanelSection title="Activity">
            <p className="text-sm text-[var(--ink-muted)]">
              The full timeline lives on the candidate record.
            </p>
            <a
              href={`/candidates/${lead.candidateId}`}
              className="mt-[var(--space-2)] inline-block text-sm font-medium text-[var(--foreground)] underline underline-offset-4"
            >
              Open candidate record
            </a>
          </SidePanelSection>
        </SidePanel>
      )}
    </>
  );
}
