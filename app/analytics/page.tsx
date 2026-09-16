import { BarList, DonutChart, WeeklyColumns } from "@/components/analytics/charts";
import { GlassCard, GlassCardHeader } from "@/components/korosha/glass-card";
import { StatCard, StatGrid } from "@/components/korosha/stat-card";
import { PageHeader } from "@/components/ui/page-header";
import { getAnalytics } from "@/lib/analytics";
import { sourceLabel, type ApplicationSource } from "@/lib/application-source";
import { DISPOSITION_LABEL } from "@/lib/calls/summary";

export const dynamic = "force-dynamic";

/** Reuses the status hue tokens — the only palette-approved colors — so
 * source, an unrelated dimension, still needs no hardcoded hex. */
const SOURCE_COLOR: Record<ApplicationSource, string> = {
  APPLY_FORM: "--status-active",
  EMAIL: "--status-open",
  REFERRAL: "--status-accepted",
  MANUAL: "--status-neutral",
};

export const metadata = {
  title: "Analytics | Korosha",
  description: "Status conversion, time to hire and calling, computed live.",
};

const percent = (share: number) => `${(share * 100).toFixed(1)}%`;
const days = (value: number) => value.toFixed(1);

export default function AnalyticsPage() {
  const analytics = getAnalytics();
  const { total, calls, timeToHire } = analytics;
  const share = (count: number) => (total ? percent(count / total) : "—");

  return (
    <main className="min-h-screen">
      <div className="k-shell">
        <PageHeader
          title="Analytics"
          subtitle="Computed from the CSV files on every request. Applications in History are included."
        />

        <StatGrid>
          <StatCard
            label="Applications"
            value={<span data-metric="applications">{total}</span>}
            hint={<><span data-metric="archived">{analytics.archived}</span> in History, still counted</>}
          />
          <StatCard
            label="Hires"
            value={<span data-metric="hires">{analytics.hires}</span>}
            hint={<><span data-metric="rejected-share">{percent(analytics.rejectedShare)}</span> rejected overall</>}
          />
          <StatCard
            label="Median time to hire"
            emphasis
            value={timeToHire ? <><span data-metric="time-to-hire-median">{days(timeToHire.median)}</span> days</> : "—"}
            hint={
              timeToHire ? (
                <>
                  Range <span data-metric="time-to-hire-min">{days(timeToHire.min)}</span> to{" "}
                  <span data-metric="time-to-hire-max">{days(timeToHire.max)}</span> days
                </>
              ) : (
                "No hires yet"
              )
            }
          />
          <StatCard
            label="Call connect rate"
            value={<span data-metric="connect-rate">{percent(calls.connectRate)}</span>}
            hint={<><span data-metric="calls">{calls.total}</span> calls logged</>}
          />
        </StatGrid>

        <div className="mt-[var(--space-6)] grid gap-[var(--space-4)] lg:grid-cols-2">
          <GlassCard>
            <GlassCardHeader title="Applications per week" description="The last 13 weeks, oldest on the left." />
            <WeeklyColumns weeks={analytics.applicationsPerWeek} noun="applications" metric="applications" />
          </GlassCard>

          <GlassCard>
            <GlassCardHeader title="Call volume per week" description="Every logged call, by the week it started." />
            <WeeklyColumns weeks={analytics.callsPerWeek} noun="calls" metric="calls" />
          </GlassCard>

          <GlassCard className="lg:col-span-2">
            <GlassCardHeader
              title="Status conversion"
              description="Applications that reached each stage at any point, as a share of all applications and of the stage before."
            />
            <BarList
              metric="funnel"
              rows={analytics.funnel.map((stage, index) => ({
                key: String(index),
                label: stage.label,
                value: stage.reached,
                detail: (
                  <>
                    <span data-metric={`funnel-share-${index}`}>{percent(stage.ofTotal)}</span> of all
                    {index > 0 && (
                      <>
                        {" · "}
                        <span data-metric={`funnel-previous-${index}`}>{percent(stage.ofPrevious)}</span> of previous
                      </>
                    )}
                  </>
                ),
              }))}
            />
          </GlassCard>

          <GlassCard>
            <GlassCardHeader title="Status breakdown" description="Where every application sits now." />
            <DonutChart
              metric="status"
              rows={analytics.byStatus.map(({ status, count }) => ({
                key: status.key,
                label: status.label,
                value: count,
                color: status.color,
                detail: share(count),
              }))}
            />
          </GlassCard>

          <GlassCard>
            <GlassCardHeader title="Source breakdown" description="Where applications came from. Email stands in for resumes production ingested." />
            <DonutChart
              metric="source"
              rows={analytics.bySource.map(({ source, count }) => ({
                key: source,
                label: sourceLabel[source],
                value: count,
                color: SOURCE_COLOR[source],
                detail: share(count),
              }))}
            />
          </GlassCard>

          <GlassCard className="lg:col-span-2">
            <GlassCardHeader title="Call outcomes" description="Every logged call by disposition." />
            <BarList
              metric="disposition"
              rows={calls.byDisposition.map(({ disposition, count }) => ({
                key: disposition,
                label: DISPOSITION_LABEL[disposition],
                value: count,
                detail: calls.total ? percent(count / calls.total) : "—",
              }))}
            />
          </GlassCard>
        </div>
      </div>
    </main>
  );
}
