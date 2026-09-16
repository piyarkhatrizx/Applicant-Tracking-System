import DynamicApplyForm from "@/components/apply/dynamic-apply-form";
import type { FieldSpec } from "@/components/apply/field-inputs";
import { SectionLabel } from "@/components/ui/section-label";
import { resolveApplyJob } from "@/lib/apply-job";
import { listJobFields } from "@/lib/data";

export const dynamic = "force-dynamic";

/** A job's code is already unique, so it doubles as its apply-page slug. */
const FALLBACK_FIELDS: FieldSpec[] = [
  { key: "first_name", label: "Name", type: "TEXT", options: [], required: false },
  { key: "email", label: "Email", type: "TEXT", options: [], required: true },
  { key: "phone", label: "Phone", type: "TEXT", options: [], required: false },
];

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const target = resolveApplyJob(slug);
  return { title: `${target.ok ? target.job.title : "Apply"} | Korosha` };
}

export default async function JobApplyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const target = resolveApplyJob(slug);
  const fields = target.ok ? listJobFields(target.job.id) : [];

  return (
    <main className="min-h-screen">
      <div className="k-shell grid overflow-hidden border border-[var(--line)] bg-[var(--surface)] lg:grid-cols-[0.78fr_1.22fr]">
        <section className="flex min-h-72 flex-col justify-between bg-[var(--surface-sidebar)] p-[var(--space-6)] text-[var(--on-sidebar)] sm:p-[var(--space-10)] lg:min-h-[680px]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--on-sidebar-accent)]">Korosha</p>
            <h1 className="mt-[var(--space-12)] max-w-sm text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
              {target.ok ? target.job.title : "This job posting"}
            </h1>
            {target.ok && target.job.description && (
              <p className="mt-[var(--space-6)] max-w-sm text-sm leading-7 text-[var(--on-sidebar-muted)]">
                {target.job.description}
              </p>
            )}
          </div>
          <p className="mt-[var(--space-12)] text-xs uppercase tracking-wide text-[var(--on-sidebar-faint)]">
            {target.ok ? `${target.job.title} · ${target.job.code}` : "Application"}
          </p>
        </section>
        <section className="p-[var(--space-6)] sm:p-[var(--space-10)] lg:p-[var(--space-12)]">
          <div className="mb-[var(--space-10)] border-b border-[var(--line)] pb-[var(--space-6)]">
            <SectionLabel>Application form</SectionLabel>
            <h2 className="mt-[var(--space-3)] text-3xl font-semibold tracking-tight">Let&apos;s get to know you</h2>
          </div>
          {target.ok ? (
            <DynamicApplyForm
              jobCode={target.job.code}
              // A job created before per-job fields existed (or via the API
              // directly) still gets a working apply page: Name/Email/Phone.
              fields={fields.length ? fields : FALLBACK_FIELDS}
            />
          ) : (
            <p role="alert" className="text-sm text-[var(--danger)]">
              {target.error}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
