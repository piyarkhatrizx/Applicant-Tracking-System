import ApplyForm from "@/app/apply/apply-form";
import { SectionLabel } from "@/components/ui/section-label";
import { resolveApplyJob } from "@/lib/apply-job";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Caregiver application | Korosha",
  description: "Apply for a caregiver opportunity.",
};

/** /apply files into DEFAULT_APPLY_JOB_CODE; /apply?job=CARE-002 (or ?job=2) picks another. */
export default async function ApplyPage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string | string[] }>;
}) {
  const raw = (await searchParams).job;
  const target = resolveApplyJob(Array.isArray(raw) ? raw[0] : raw);

  return (
    <main className="min-h-screen">
      <div className="k-shell grid overflow-hidden border border-[var(--line)] bg-[var(--surface)] lg:grid-cols-[0.78fr_1.22fr]">
        <section className="flex min-h-72 flex-col justify-between bg-[var(--surface-sidebar)] p-[var(--space-6)] text-[var(--on-sidebar)] sm:p-[var(--space-10)] lg:min-h-[680px]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--on-sidebar-accent)]">Korosha care team</p>
            <h1 className="mt-[var(--space-12)] max-w-sm text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">Your care work matters.</h1>
            <p className="mt-[var(--space-6)] max-w-sm text-sm leading-7 text-[var(--on-sidebar-muted)]">Tell us a little about your experience and the kind of caregiver opportunity you are looking for.</p>
          </div>
          <p className="mt-[var(--space-12)] text-xs uppercase tracking-wide text-[var(--on-sidebar-faint)]">
            {target.ok ? `${target.job.title} · ${target.job.code}` : "Caregiver application"} · 2 minutes
          </p>
        </section>
        <section className="p-[var(--space-6)] sm:p-[var(--space-10)] lg:p-[var(--space-12)]">
          <div className="mb-[var(--space-10)] border-b border-[var(--line)] pb-[var(--space-6)]"><SectionLabel>Application form</SectionLabel><h2 className="mt-[var(--space-3)] text-3xl font-semibold tracking-tight">Let&apos;s get to know you</h2><p className="mt-[var(--space-2)] text-sm text-[var(--ink-muted)]"><span className="text-[var(--foreground)]">*</span> Required fields · CPA certification is optional</p></div>
          {target.ok ? (
            // The resolved code is pinned, so the submission files where the page said it would.
            <ApplyForm jobCode={target.job.code} />
          ) : (
            <p role="alert" className="text-sm text-[var(--danger)]">{target.error}</p>
          )}
        </section>
      </div>
    </main>
  );
}
