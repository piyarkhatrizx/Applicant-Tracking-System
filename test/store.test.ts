import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createStore, parseCsv, serializeCsv } from "@/lib/store";

const tricky = [
  ["id", "body"],
  ["1", "plain"],
  ["2", 'she said "call me back", then hung up'],
  ["3", "line one\nline two\r\nline three"],
  ["4", ""],
  ["5", ",leading comma"],
  ["6", "Fernández-Villalobos · 😀"],
];

describe("csv", () => {
  it("round-trips quotes, commas, newlines, empties and unicode", () => {
    expect(parseCsv(serializeCsv(tricky))).toEqual(tricky);
  });

  it("reads CRLF files and a missing trailing newline", () => {
    expect(parseCsv('id,body\r\n1,"a,b"\r\n2,c')).toEqual([["id", "body"], ["1", "a,b"], ["2", "c"]]);
  });

  it("rejects an unterminated quote instead of silently truncating", () => {
    expect(() => parseCsv('id,body\n1,"open')).toThrow();
  });
});

describe("store", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      fs.chmodSync(dir, 0o755);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  function fixture() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "store-"));
    dirs.push(dir);
    fs.writeFileSync(path.join(dir, "notes.csv"), serializeCsv([["id", "applicant_id", "body"], ...tricky.slice(1).map(([id, body]) => [id, "7", body])]));
    return dir;
  }

  it("writes through to disk when the directory is writable", () => {
    const dir = fixture();
    const store = createStore(dir);
    expect(store.isWritable()).toBe(true);

    const inserted = store.insert("notes", { applicant_id: "9", body: 'new "quoted", multi\nline' });
    expect(inserted.id).toBe("7");
    expect(store.update("notes", 2, { body: "edited" })?.body).toBe("edited");
    expect(store.remove("notes", 4)).toBe(true);
    expect(store.remove("notes", 4)).toBe(false);

    // A fresh store reads the file, proving the changes hit disk intact.
    const reread = createStore(dir);
    expect(reread.selectOne("notes", 7)?.body).toBe('new "quoted", multi\nline');
    expect(reread.selectOne("notes", 3)?.body).toBe("line one\nline two\r\nline three");
    expect(reread.selectOne("notes", 2)?.body).toBe("edited");
    expect(reread.selectAll("notes", { applicant_id: "7" })).toHaveLength(5);
  });

  it("keeps mutations in memory when the directory is read-only", () => {
    const dir = fixture();
    const before = fs.readFileSync(path.join(dir, "notes.csv"), "utf8");
    fs.chmodSync(dir, 0o555);
    fs.chmodSync(path.join(dir, "notes.csv"), 0o444);

    const store = createStore(dir);
    expect(store.isWritable()).toBe(false);
    store.insert("notes", { applicant_id: "9", body: "memory only" });
    expect(store.selectOne("notes", { body: "memory only" })?.id).toBe("7");

    expect(fs.readFileSync(path.join(dir, "notes.csv"), "utf8")).toBe(before);
    fs.chmodSync(path.join(dir, "notes.csv"), 0o644);
  });

  it("keeps file order across update and remove", () => {
    const store = createStore(fixture());
    const ids = () => store.selectAll("notes").map((row) => row.id);
    store.update("notes", 2, { body: "edited" });
    expect(ids()).toEqual(["1", "2", "3", "4", "5", "6"]);
    store.remove("notes", 3);
    store.insert("notes", { applicant_id: "7", body: "appended" });
    expect(ids()).toEqual(["1", "2", "4", "5", "6", "7"]);
  });

  it("honours a free explicit id and rejects a taken or invalid one", () => {
    const store = createStore(fixture());
    expect(store.insert("notes", { id: "40", body: "explicit" }).id).toBe("40");
    expect(store.insert("notes", { body: "next" }).id).toBe("41");
    expect(() => store.insert("notes", { id: "2", body: "dupe" })).toThrow(/already exists/);
    expect(() => store.insert("notes", { id: "0", body: "bad" })).toThrow(/invalid id/);
    expect(store.selectAll("notes", { body: "dupe" })).toHaveLength(0);
  });

  it("refuses to read a file with duplicate ids", () => {
    const dir = fixture();
    fs.appendFileSync(path.join(dir, "notes.csv"), "2,7,second row two\n");
    expect(() => createStore(dir).selectAll("notes")).toThrow(/duplicate id 2/);
  });

  it("refuses unknown tables and columns", () => {
    const store = createStore(fixture());
    expect(() => store.insert("notes", { nope: "x" })).toThrow(/no column/);
    expect(() => store.selectAll("../etc" as never)).toThrow(/Unknown table/);
  });
});
