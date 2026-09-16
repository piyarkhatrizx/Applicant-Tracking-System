import type { ReactNode } from "react";

/**
 * Plain SVG and CSS. No chart library: the charts are simple enough, and none
 * is installed. Server components, so hover detail comes from native titles.
 *
 * Marks carry --chart-neutral or a status token; text always uses ink tokens,
 * never a mark color.
 */

const dayLabel = (date: Date) => date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** A bar with 4px rounded top corners and a square base on the baseline. */
function columnPath(x: number, y: number, width: number, height: number) {
  const r = Math.min(4, height, width / 2);
  return `M${x},${y + height} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height} Z`;
}

/**
 * One series of weekly counts, oldest on the left. Direct labels only on the
 * peak and the latest week; every value is in the hover title and the table.
 */
export function WeeklyColumns({
  weeks,
  noun,
  metric,
}: {
  weeks: Array<{ weekStart: Date; count: number }>;
  noun: string;
  metric: string;
}) {
  const width = 520;
  const height = 160;
  const top = 18;
  const bottom = 22;
  const plot = height - top - bottom;
  const slot = width / weeks.length;
  const bar = Math.min(24, slot - 8);
  const max = Math.max(1, ...weeks.map((week) => week.count));
  const peak = weeks.reduce((best, week, index) => (week.count > weeks[best].count ? index : best), 0);

  return (
    <figure>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`${noun} per week, oldest to newest: ${weeks.map((week) => week.count).join(", ")}`}
      >
        <line x1={0} x2={width} y1={top + plot / 2} y2={top + plot / 2} stroke="var(--line)" strokeDasharray="2 4" />
        <line x1={0} x2={width} y1={top + plot} y2={top + plot} stroke="var(--line-strong)" />
        {weeks.map((week, index) => {
          const barHeight = (week.count / max) * plot;
          const x = index * slot + (slot - bar) / 2;
          const y = top + plot - barHeight;
          return (
            <g key={week.weekStart.toISOString()}>
              <title>{`Week of ${dayLabel(week.weekStart)}: ${week.count} ${noun}`}</title>
              {/* The hit target is the whole slot, not the thin bar. */}
              <rect x={index * slot} y={0} width={slot} height={top + plot} fill="transparent" />
              {week.count > 0 && <path d={columnPath(x, y, bar, barHeight)} fill="var(--chart-neutral)" />}
              {(index === peak || index === weeks.length - 1) && (
                <text x={x + bar / 2} y={y - 5} textAnchor="middle" fontSize={10} fill="var(--ink-muted)">
                  {week.count}
                </text>
              )}
              {index % 2 === 0 && (
                <text x={index * slot + slot / 2} y={height - 6} textAnchor="middle" fontSize={10} fill="var(--ink-faint)">
                  {dayLabel(week.weekStart)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <details className="mt-[var(--space-2)]">
        <summary className="cursor-pointer text-xs text-[var(--ink-muted)]">Show as a table</summary>
        <table className="mt-[var(--space-2)] w-full text-xs">
          <thead>
            <tr className="text-left text-[var(--ink-muted)]">
              <th className="font-medium">Week of</th>
              <th className="text-right font-medium">{noun}</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, index) => (
              <tr key={week.weekStart.toISOString()} className="border-t border-[var(--line)]">
                <td>{dayLabel(week.weekStart)}</td>
                <td className="k-tnum text-right" data-metric={`${metric}-week-${weeks.length - 1 - index}`}>
                  {week.count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

/**
 * A ring built from stroke-dasharray segments, one per row. The reveal is a
 * plain flat-color mask laid over the finished chart, fading its own opacity
 * to 0 (`.k-donut-mask`) — not the chart's opacity. Two earlier versions
 * animated the SVG's own opacity (per-wedge, then as one block) and both
 * stayed laggy: a heavily dashed, large-stroke-width vector shape can force
 * the browser to re-rasterize on every frame of an opacity animation, no
 * matter how cheap that property looks on paper. A plain solid div has none
 * of that content, so its opacity animation is compositor-only regardless of
 * what it's covering. Plain CSS, no client component, no JS.
 * Server-rendered, so it replays on every fresh navigation to the page (the
 * SVG is freshly inserted DOM each time `#main` remounts on route change).
 * Color is never the only identifier: a text legend sits beside the ring, and
 * every wedge carries a native <title> for hover detail, same as WeeklyColumns.
 */
export function DonutChart({
  rows,
  metric,
  size = 168,
  thickness = 24,
}: {
  rows: Array<{ key: string; label: ReactNode; value: number; color?: string; detail?: ReactNode }>;
  metric: string;
  size?: number;
  thickness?: number;
}) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let cumulative = 0;

  return (
    <div className="relative flex flex-wrap items-center gap-[var(--space-4)]">
      <div aria-hidden="true" className="k-donut-mask pointer-events-none absolute inset-0 bg-[var(--surface)]" />
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        role="img"
        aria-label={`${metric} breakdown: ${rows.map((row) => `${row.label} ${row.value}`).join(", ")}`}
      >
        <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--line)" strokeWidth={thickness} />
        {total > 0 && (
          <g transform={`rotate(-90 ${center} ${center})`}>
            {rows.map((row) => {
              if (row.value <= 0) return null;
              const length = (row.value / total) * circumference;
              const offset = cumulative;
              cumulative += length;
              return (
                <circle
                  key={row.key}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={`var(${row.color ?? "--chart-neutral"})`}
                  strokeWidth={thickness}
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={-offset}
                >
                  <title>{`${row.label}: ${row.value}`}</title>
                </circle>
              );
            })}
          </g>
        )}
      </svg>
      <ul className="min-w-[10rem] flex-1 space-y-[var(--space-2)]">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-[var(--space-2)] text-sm">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: `var(${row.color ?? "--chart-neutral"})` }}
            />
            <span className="min-w-0 flex-1 truncate text-[var(--ink-muted)]">{row.label}</span>
            <span className="k-tnum whitespace-nowrap text-right font-medium text-[var(--foreground)]">
              <span data-metric={`${metric}-${row.key}`}>{row.value}</span>
              {row.detail && <span className="ml-[var(--space-2)] font-normal text-[var(--ink-muted)]">{row.detail}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Labelled horizontal bars. Each row names its category in text and prints its
 * value, so the list reads as a table and color never carries identity alone.
 */
export function BarList({
  rows,
  metric,
}: {
  rows: Array<{ key: string; label: ReactNode; value: number; detail?: ReactNode; color?: string }>;
  metric: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <ul className="space-y-[var(--space-2)]">
      {rows.map((row) => (
        <li key={row.key} className="grid grid-cols-[8.5rem_minmax(0,1fr)_auto] items-center gap-[var(--space-3)] text-sm">
          <span className="truncate text-[var(--ink-muted)]">{row.label}</span>
          <span className="h-2.5 overflow-hidden rounded-r-[4px] bg-[var(--surface-sunken)]">
            <span
              className="block h-full rounded-r-[4px]"
              style={{ width: `${(row.value / max) * 100}%`, backgroundColor: `var(${row.color ?? "--chart-neutral"})` }}
            />
          </span>
          <span className="k-tnum whitespace-nowrap text-right text-[var(--foreground)]">
            <span data-metric={`${metric}-${row.key}`}>{row.value}</span>
            {row.detail && <span className="ml-[var(--space-2)] text-[var(--ink-muted)]">{row.detail}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
