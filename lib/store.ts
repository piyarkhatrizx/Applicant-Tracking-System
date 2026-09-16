import fs from "node:fs";
import path from "node:path";

/**
 * The only module that touches the filesystem. Every read and write in the app
 * goes through the helpers exported at the bottom.
 *
 * Two modes, chosen once by a cached write probe:
 *   writable  - every call reads the CSV from disk and every mutation rewrites it.
 *   read-only - (Vercel) each CSV is loaded into memory on first use, and
 *               mutations live there until the next deploy or cold start.
 * The helpers are identical in both; only `load` and `save` differ.
 *
 * CONVENTIONS — the layer above relies on these; do not invent per-field rules.
 *
 *   Values. Every cell is a string in and out. Typed mapping belongs to the
 *   caller, but the encoding is fixed here:
 *     absent    ""                        the ONLY null. Never the text "null".
 *     boolean   "true" | "false" | ""     "" = no answer (e.g. the optional
 *                                         is_cpa_certified question).
 *     number    decimal digits  | ""
 *     timestamp ISO 8601 UTC, toISOString() shape | ""  (archived_at, ended_at)
 *     enum      the enum key    | ""
 *   There is deliberately no second "not applicable" marker. Where the domain
 *   needs that distinction it derives it from a required sibling instead: the
 *   screening block is absent when is_at_least_18 is "" (that question is
 *   required on /apply, so it is never blank on a form submission), and
 *   is_cpa_certified is "Not answered" only when the block is present. A text
 *   field's blank and absent are the same thing, as they were in Postgres
 *   after the old intake normalized "" to null.
 *
 *   Ids. Every row has a positive integer id, unique within its file. A file
 *   that breaks this throws on read rather than serving ambiguous rows.
 *
 *   Order. selectAll returns rows in file order. insert appends; update
 *   rewrites a row in place, so it keeps its position; remove closes the gap
 *   without moving anyone else. The same holds in memory mode. File order is a
 *   storage detail, not a display order — callers sort explicitly.
 *
 *   Reads. In writable mode every call re-reads and re-parses the file, with no
 *   cache, on purpose: reset rewrites the files from another process and a hand
 *   edit shows up on the next request with nothing to invalidate. At demo scale
 *   (hundreds of rows, six files) a page that reads five tables parses them in
 *   well under a few milliseconds. If that stops being true, cache per request
 *   in the caller with React cache(), not here.
 *
 * Server only. Importing this into a client component fails the build on `fs`.
 */

export const TABLES = [
  "applicants",
  "jobs",
  "statuses",
  "notes",
  "call_logs",
  "activity",
  "job_fields",
  "application_field_values",
] as const;
export type Table = (typeof TABLES)[number];
export type Row = Record<string, string> & { id: string };

// ---------------------------------------------------------------------------
// CSV (RFC 4180). Exported for the round-trip test.
// ---------------------------------------------------------------------------

export function parseCsv(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char !== '"') field += char;
      else if (text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      record.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else field += char;
  }

  if (quoted) throw new Error("CSV ends inside a quoted field");
  // A final line without a trailing newline.
  if (field !== "" || record.length) {
    record.push(field);
    records.push(record);
  }
  return records;
}

function quote(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function serializeCsv(records: string[][]): string {
  return records.map((record) => record.map(quote).join(",")).join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

type Loaded = { columns: string[]; rows: Row[] };

const isId = (value: string) => /^[1-9]\d*$/.test(value);

export function createStore(dir: string) {
  const file = (table: Table) => {
    if (!TABLES.includes(table)) throw new Error(`Unknown table: ${table}`);
    return path.join(dir, `${table}.csv`);
  };

  let writable: boolean | null = null;
  function isWritable() {
    if (writable === null) {
      const probe = path.join(dir, `.write-probe-${process.pid}`);
      try {
        fs.writeFileSync(probe, "");
        fs.unlinkSync(probe);
        writable = true;
      } catch {
        writable = false;
      }
    }
    return writable;
  }

  function readDisk(table: Table): Loaded {
    const [columns = [], ...records] = parseCsv(fs.readFileSync(file(table), "utf8"));
    if (!columns.includes("id")) throw new Error(`${table}.csv has no id column`);
    const rows = records.map(
      (record) => Object.fromEntries(columns.map((column, i) => [column, record[i] ?? ""])) as Row,
    );
    const seen = new Set<string>();
    for (const row of rows) {
      if (!isId(row.id)) throw new Error(`${table}.csv has a non-numeric id: "${row.id}"`);
      if (seen.has(row.id)) throw new Error(`${table}.csv has duplicate id ${row.id}`);
      seen.add(row.id);
    }
    return { columns, rows };
  }

  const memory = new Map<Table, Loaded>();

  function load(table: Table): Loaded {
    if (isWritable()) return readDisk(table);
    let loaded = memory.get(table);
    if (!loaded) {
      loaded = readDisk(table);
      memory.set(table, loaded);
    }
    return loaded;
  }

  function save(table: Table, { columns, rows }: Loaded) {
    if (!isWritable()) {
      memory.set(table, { columns, rows });
      return;
    }
    // Write-then-rename, so a crash mid-write never leaves a truncated table.
    const target = file(table);
    const temp = `${target}.${process.pid}.tmp`;
    fs.writeFileSync(temp, serializeCsv([columns, ...rows.map((row) => columns.map((c) => row[c] ?? ""))]));
    fs.renameSync(temp, target);
  }

  function checkColumns(table: Table, columns: string[], values: Record<string, string>) {
    const unknown = Object.keys(values).filter((key) => !columns.includes(key));
    if (unknown.length) throw new Error(`${table} has no column(s): ${unknown.join(", ")}`);
  }

  const matches = (row: Row, where: Partial<Row> | ((row: Row) => boolean)) =>
    typeof where === "function"
      ? where(row)
      : Object.entries(where).every(([key, value]) => row[key] === value);

  // ponytail: every mutation rewrites the whole file and there is no
  // cross-file transaction. Fine for a single-process demo with hundreds of
  // rows; a real database is the upgrade path, which is what production used.
  return {
    selectAll(table: Table, where?: Partial<Row> | ((row: Row) => boolean)): Row[] {
      const { rows } = load(table);
      return (where ? rows.filter((row) => matches(row, where)) : rows).map((row) => ({ ...row }));
    },

    selectOne(table: Table, where: number | string | Partial<Row> | ((row: Row) => boolean)): Row | null {
      const test = typeof where === "number" || typeof where === "string" ? { id: String(where) } : where;
      const row = load(table).rows.find((candidate) => matches(candidate, test));
      return row ? { ...row } : null;
    },

    insert(table: Table, values: Record<string, string>): Row {
      const loaded = load(table);
      checkColumns(table, loaded.columns, values);
      // An explicit id is honoured only if it is valid and free. It is never
      // silently replaced and never written twice.
      if (values.id !== undefined) {
        if (!isId(values.id)) throw new Error(`${table}: invalid id "${values.id}"`);
        if (loaded.rows.some((row) => row.id === values.id)) {
          throw new Error(`${table}: id ${values.id} already exists`);
        }
      }
      const nextId = values.id ?? String(loaded.rows.reduce((max, row) => Math.max(max, Number(row.id)), 0) + 1);
      const row = {
        ...Object.fromEntries(loaded.columns.map((column) => [column, values[column] ?? ""])),
        id: nextId,
      } as Row;
      save(table, { columns: loaded.columns, rows: [...loaded.rows, row] });
      return { ...row };
    },

    update(table: Table, id: number | string, patch: Record<string, string>): Row | null {
      const loaded = load(table);
      checkColumns(table, loaded.columns, patch);
      // A row keeps its identity: an id in the patch is ignored.
      const changes = { ...patch };
      delete changes.id;
      let updated: Row | null = null;
      const rows = loaded.rows.map((row) => {
        if (row.id !== String(id)) return row;
        updated = { ...row, ...changes };
        return updated;
      });
      if (updated) save(table, { columns: loaded.columns, rows });
      return updated ? { ...(updated as Row) } : null;
    },

    remove(table: Table, id: number | string): boolean {
      const loaded = load(table);
      const rows = loaded.rows.filter((row) => row.id !== String(id));
      if (rows.length === loaded.rows.length) return false;
      save(table, { columns: loaded.columns, rows });
      return true;
    },

    isWritable,
  };
}

const store = createStore(path.join(process.cwd(), "data"));

export const { selectAll, selectOne, insert, update, remove, isWritable } = store;
