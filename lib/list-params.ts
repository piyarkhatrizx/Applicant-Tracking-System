import { APPLICATION_SOURCES, type ApplicationSource } from "@/lib/application-source";

/**
 * The one contract for list views: ?source=&status=&sort=&dir=&page=
 *
 * Everything here is untrusted input, so sort keys are matched against an
 * allowlist per view rather than passed through. An unknown key falls back to
 * the view's default and is reported in `rejected`; it never reaches a sorter.
 */
export type ListSearchParams = Record<string, string | string[] | undefined>;

export const PAGE_SIZE = 50;

/** Sortable columns per view, each with its natural direction. `dir` overrides it. */
export const SORT_KEYS = {
  /**
   * The inbox. Default is newest lead first, because the product goal is speed
   * to first contact and the freshest lead is the one worth calling.
   */
  leads: { appliedAt: "desc", status: "asc", source: "asc", name: "asc" },
} as const satisfies Record<string, Record<string, "asc" | "desc">>;

export type ListView = keyof typeof SORT_KEYS;
export type SortKey<V extends ListView> = keyof (typeof SORT_KEYS)[V] & string;

const DEFAULT_SORT: { [V in ListView]: SortKey<V> } = {
  leads: "appliedAt",
};

export type ParsedListParams<V extends ListView> = {
  source: ApplicationSource | null;
  /** Scopes the inbox to one requisition. Carries /jobs/[id] bookmarks over. */
  job: number | null;
  /** Leads with no CALL_LOGGED event yet — the queue that matters. */
  uncalled: boolean;
  /** A status key. Resolved by the query; an unknown key simply matches nothing. */
  status: string | null;
  /** Search over name, email and phone. Trimmed; blank means no search. */
  q: string | null;
  sort: SortKey<V>;
  dir: "asc" | "desc";
  page: number;
  skip: number;
  take: number;
  /** True when the caller sent something we refused. Lets a view say so. */
  rejected: string[];
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** Rebuild a query string with one key changed. Keeps filters when sorting. */
export function withParam(
  params: ListSearchParams,
  key: string,
  value: string | null,
) {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    const single = first(v);
    if (single && k !== key) next.set(k, single);
  }
  if (value) next.set(key, value);
  // Any filter or sort change invalidates the current offset.
  if (key !== "page") next.delete("page");
  const query = next.toString();
  return query ? `?${query}` : "";
}

export function parseListParams<V extends ListView>(
  view: V,
  params: ListSearchParams,
): ParsedListParams<V> {
  const rejected: string[] = [];

  const rawSource = first(params.source);
  const source = APPLICATION_SOURCES.includes(rawSource as ApplicationSource)
    ? (rawSource as ApplicationSource)
    : null;
  if (rawSource && !source) rejected.push("source");

  // Statuses are user-editable rows, so there is no static list to check
  // against here. The shape is constrained and the query resolves it.
  const rawStatus = first(params.status);
  const status = rawStatus && /^[A-Za-z0-9_-]{1,64}$/.test(rawStatus) ? rawStatus : null;
  if (rawStatus && !status) rejected.push("status");

  // Own keys only: `in` would also accept "constructor" and "toString".
  const allowed: Record<string, "asc" | "desc"> = SORT_KEYS[view];
  const rawSort = first(params.sort);
  const sort = (rawSort && Object.hasOwn(allowed, rawSort) ? rawSort : DEFAULT_SORT[view]) as SortKey<V>;
  if (rawSort && rawSort !== sort) rejected.push("sort");

  const rawDir = first(params.dir);
  const dir = rawDir === "asc" || rawDir === "desc" ? rawDir : null;
  if (rawDir && !dir) rejected.push("dir");

  const rawJob = first(params.job);
  const job = rawJob && /^[1-9]\d{0,8}$/.test(rawJob) ? Number(rawJob) : null;
  if (rawJob && job === null) rejected.push("job");

  const uncalled = first(params.uncalled) === "1";

  const rawQuery = first(params.q)?.trim() ?? "";
  const q = rawQuery && rawQuery.length <= 100 ? rawQuery : null;
  if (rawQuery.length > 100) rejected.push("q");

  const rawPage = first(params.page);
  const parsedPage = Number(rawPage);
  const page = Number.isInteger(parsedPage) && parsedPage >= 1 ? parsedPage : 1;
  if (rawPage && page === 1 && rawPage !== "1") rejected.push("page");

  return {
    source,
    job,
    uncalled,
    status,
    q,
    sort,
    dir: dir ?? allowed[sort],
    page,
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    rejected,
  };
}
