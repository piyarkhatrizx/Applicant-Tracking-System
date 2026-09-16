"use client";

import { useState } from "react";
import {
  GlassCard,
  GlassCardHeader,
  KTableHead,
  KTableRow,
  SidePanel,
  SidePanelField,
  SidePanelSection,
  StatCard,
  StatGrid,
  StatusDot,
  StatusPill,
  STATUS_COLOR_TOKENS,
} from "@/components/korosha";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * The Korosha reference. Everything the rest of the build should reach for.
 * If a page needs something that is not here, add it here first.
 */

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mb-[var(--space-10)]">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {note && <p className="mt-[var(--space-1)] max-w-2xl text-sm text-[var(--ink-muted)]">{note}</p>}
      <div className="mt-[var(--space-4)]">{children}</div>
    </section>
  );
}

const SAMPLE_LEADS = [
  { id: "1", name: "Marguerite Delacroix-Whitfield", source: "Apply page", color: "--status-open", status: "New", age: "4m ago" },
  { id: "2", name: "Bo Ng", source: "Apply page", color: "--status-active", status: "Screening", age: "2h ago" },
  { id: "3", name: "Thaddeus Okonjo-Iwuchukwu", source: "Referral", color: "--status-accepted", status: "Accepted", age: "1d ago" },
  { id: "4", name: "Ana Cruz", source: "Apply page", color: "--status-rejected", status: "Rejected", age: "3d ago", muted: true },
];

export function DesignSystemDemo() {
  const [panelOpen, setPanelOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="k-shell">
      <header className="mb-[var(--space-6)]">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
          Korosha
        </p>
        <h1 className="mt-[var(--space-2)] text-2xl font-semibold tracking-tight">
          Design system
        </h1>
        <p className="mt-[var(--space-2)] max-w-2xl text-sm text-[var(--ink-muted)]">
          Flat light surfaces. Primary actions are near-black; the blue accent marks focus, selection
          and checked state only. Every color here comes from styles/tokens.css.
        </p>
      </header>

      <Section
        title="Glass card"
        note="A solid surface with a hairline. Glass is reserved for the sticky nav and toasts."
      >
        <div className="grid gap-[var(--space-4)] sm:grid-cols-2">
          <GlassCard>
            <GlassCardHeader title="Standard panel" description="A solid surface over the page." />
            <p className="text-sm text-[var(--ink-muted)]">
              Body text sits on the panel, never on a bare tint.
            </p>
          </GlassCard>
          <GlassCard>
            <GlassCardHeader
              title="With actions"
              description="Header actions sit right."
              actions={<Button variant="secondary" size="sm">Edit</Button>}
            />
            <GlassCard flat padded className="mt-[var(--space-1)]">
              <p className="text-sm text-[var(--ink-muted)]">
                Nested region: a flat surface inside the card.
              </p>
            </GlassCard>
          </GlassCard>
        </div>
      </Section>

      <Section title="Buttons" note="Primary is near-black. The accent is never a button fill.">
        <div className="flex flex-wrap items-center gap-[var(--space-2)]">
          <Button variant="primary">Call lead</Button>
          <Button variant="secondary">Add note</Button>
          <Button variant="danger">Reject</Button>
          <Button variant="icon" aria-label="More actions">⋯</Button>
          <Button variant="primary" loading>Saving</Button>
          <Button variant="secondary" disabled>Disabled</Button>
        </div>
        <div className="mt-[var(--space-3)] flex flex-wrap items-center gap-[var(--space-2)]">
          <Button variant="secondary" size="sm">Small</Button>
          <Button variant="secondary" size="md">Medium</Button>
          <Button variant="secondary" size="lg">Large</Button>
        </div>
      </Section>

      <Section
        title="Status pill"
        note="Colors are token names stored on the Status row, never raw hex, so a recruiter cannot create a status that fails contrast."
      >
        <div className="flex flex-wrap items-center gap-[var(--space-2)]">
          {STATUS_COLOR_TOKENS.map((token) => (
            <StatusPill key={token} color={token} label={token.replace("--status-", "")} />
          ))}
          <StatusPill color="--not-a-real-token" label="unknown → neutral" />
          <span className="ml-[var(--space-2)] inline-flex items-center gap-[var(--space-1)] text-sm text-[var(--ink-muted)]">
            <StatusDot color="--status-accepted" /> dot variant
          </span>
        </div>
      </Section>

      <Section title="Stat card" note="The headline metric takes a dark rule, not a colored fill.">
        <StatGrid>
          <StatCard label="Applications" value="32" hint="Last 7 days" />
          <StatCard label="Calls" value="18" hint="Last 7 days" />
          <StatCard label="Accepted" value="6" hint="Derived from counts_as" />
          <StatCard label="Median to first call" value="14m" hint="Headline metric" emphasis />
        </StatGrid>
      </Section>

      <Section title="Table row" note="Row click opens the side panel. Never a page navigation.">
        <GlassCard padded={false} className="overflow-hidden">
          <KTableHead>
            <span className="flex-1">Lead</span>
            <span className="w-28">Source</span>
            <span className="w-28">Status</span>
            <span className="w-20 text-right">Applied</span>
          </KTableHead>
          {SAMPLE_LEADS.map((lead) => (
            <KTableRow
              key={lead.id}
              selected={selected === lead.id}
              muted={lead.muted}
              onOpen={() => {
                setSelected(lead.id);
                setPanelOpen(true);
              }}
            >
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {lead.name}
              </span>
              <span className="w-28 text-sm text-[var(--ink-muted)]">{lead.source}</span>
              <span className="w-28">
                <StatusPill color={lead.color} label={lead.status} />
              </span>
              <span className="w-20 text-right font-mono text-xs text-[var(--ink-muted)]">
                {lead.age}
              </span>
            </KTableRow>
          ))}
        </GlassCard>
      </Section>

      <Section title="Empty state">
        <div className="grid gap-[var(--space-4)] sm:grid-cols-2">
          <EmptyState
            title="No leads yet"
            description="Submissions from the apply page land here the moment they arrive."
            action={{ label: "Open apply page", href: "/apply" }}
          />
          <EmptyState compact title="Nothing in this view" description="Try clearing the filters." />
        </div>
      </Section>

      <Section title="Side panel" note="Opaque, not glass: it sits above a scrolling list.">
        <Button variant="primary" onClick={() => setPanelOpen(true)}>
          Open side panel
        </Button>
      </Section>

      <SidePanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        eyebrow="Lead"
        title={SAMPLE_LEADS.find((lead) => lead.id === selected)?.name ?? "Marguerite Delacroix-Whitfield"}
        description="Applied 4 minutes ago via the apply page"
        actions={
          <>
            <Button variant="primary" size="sm">Call</Button>
            <Button variant="secondary" size="sm">Note</Button>
            <Button variant="icon" size="sm" aria-label="More">⋯</Button>
          </>
        }
      >
        <SidePanelSection title="Contact">
          <dl>
            <SidePanelField label="Phone">(216) 555-0142</SidePanelField>
            <SidePanelField label="Email">marguerite.delacroix@example.com</SidePanelField>
            <SidePanelField label="Location">Cleveland, OH</SidePanelField>
          </dl>
        </SidePanelSection>
        <SidePanelSection title="Application">
          <dl>
            <SidePanelField label="18 or older">Yes</SidePanelField>
            <SidePanelField label="Medicaid patient">No</SidePanelField>
          </dl>
        </SidePanelSection>
      </SidePanel>
    </div>
  );
}

export default DesignSystemDemo;
