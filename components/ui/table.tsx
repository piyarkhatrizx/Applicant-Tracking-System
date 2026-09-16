import type {
  ComponentPropsWithRef,
  HTMLAttributes,
  ReactNode,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";
import { Spinner } from "./button";
import { IconArrowDown, IconArrowUp } from "@/components/korosha/icon";

export type SortDirection = "asc" | "desc" | false;

export function Table({
  children,
  className = "",
  containerClassName = "",
  ...props
}: TableHTMLAttributes<HTMLTableElement> & { containerClassName?: string }) {
  return (
    <div
      className={`relative overflow-auto border border-[var(--line)] bg-[var(--surface)] ${containerClassName}`}
    >
      <table
        className={`w-full border-collapse text-left text-sm ${className}`}
        {...props}
      >
        {children}
      </table>
    </div>
  );
}

/** Sticky by default: the header is the one row that must never scroll away. */
export function TableHeader({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <thead
      className={`ui-sticky-head text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)] ${className}`}
    >
      {children}
    </thead>
  );
}

export function TableBody({ children, className = "", ...props }: ComponentPropsWithRef<"tbody">) {
  return (
    <tbody className={className} {...props}>
      {children}
    </tbody>
  );
}

/**
 * Rows never animate on mount — a recruiter scrolls hundreds of these a day.
 * `selected` is the checkbox/multi-select state; `active` is the keyboard cursor.
 */
export function TableRow({
  children,
  selected = false,
  active = false,
  className = "",
  ...props
}: HTMLAttributes<HTMLTableRowElement> & { selected?: boolean; active?: boolean }) {
  return (
    <tr
      aria-selected={selected || undefined}
      data-active={active || undefined}
      className={[
        "ui-row border-b border-[var(--line)] last:border-0",
        selected ? "bg-[var(--surface-selected)]" : "hover:bg-[var(--surface-hover)]",
        active ? "ui-row-selected" : "",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </tr>
  );
}

/**
 * `py-[var(--space-1)]` gives a ~28px row ONLY when every cell is a single line.
 *
 * The real list views stack name over email, which makes rows ~47px, so about
 * 12 fit above the fold on /jobs/[id] at an 800px viewport — not the ~25 an
 * earlier version of this comment claimed. Measure before relying on a number
 * here: row height is set by the tallest cell's content, not by this padding.
 */
const cellPadding = "px-[var(--space-2)] py-[var(--space-1)] align-middle";

export function TableCell({
  children,
  header = false,
  className = "",
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & { header?: boolean }) {
  if (header) {
    return (
      <th scope="col" className={`${cellPadding} font-semibold ${className}`} {...props}>
        {children}
      </th>
    );
  }

  return (
    <td className={`${cellPadding} ${className}`} {...props}>
      {children}
    </td>
  );
}

/**
 * Sortable header. The whole cell is a button so the hit target matches the
 * label, and `aria-sort` on the th is what assistive tech actually reads.
 */
export function TableSortHeader({
  children,
  sorted = false,
  onSort,
  align = "left",
  className = "",
  ...props
}: Omit<ThHTMLAttributes<HTMLTableCellElement>, "onClick"> & {
  children: ReactNode;
  sorted?: SortDirection;
  onSort?: () => void;
  align?: "left" | "right";
}) {
  const ariaSort = sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none";

  return (
    <th
      scope="col"
      aria-sort={onSort ? ariaSort : undefined}
      className={`${cellPadding} font-semibold ${className}`}
      {...props}
    >
      <button
        type="button"
        onClick={onSort}
        disabled={!onSort}
        className={`ui-button inline-flex w-full items-center gap-[var(--space-1)] text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)] hover:text-[var(--foreground)] disabled:cursor-default disabled:hover:text-[var(--ink-muted)] ${
          align === "right" ? "justify-end" : "justify-start"
        }`}
      >
        {children}
        {onSort && (
          <span aria-hidden="true" className={`inline-flex w-[1em] shrink-0 ${sorted ? "text-[var(--foreground)]" : "opacity-0"}`}>
            {sorted === "desc" ? <IconArrowDown size="1em" /> : <IconArrowUp size="1em" />}
          </span>
        )}
      </button>
    </th>
  );
}

export function TableMessageRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-[var(--space-2)] py-[var(--space-6)] text-center text-[var(--ink-muted)]">
        {children}
      </td>
    </tr>
  );
}

/**
 * No shimmer skeleton: at real latencies it would flash for less time than it
 * takes to read. A single quiet line is honest and does not fight the eye.
 */
export function TableLoadingRow({ colSpan, label = "Loading" }: { colSpan: number; label?: string }) {
  return (
    <TableMessageRow colSpan={colSpan}>
      <span className="inline-flex items-center gap-[var(--space-2)] text-sm" role="status">
        <Spinner />
        {label}
      </span>
    </TableMessageRow>
  );
}
