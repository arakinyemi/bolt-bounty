import { describe, expect, it } from "vitest";
import { openDb } from "../src/db/index.js";

describe("schema", () => {
  it("applies and enforces the status enum", () => {
    const db = openDb(":memory:");
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as { name: string }[];
    expect(tables.map((t) => t.name)).toEqual(expect.arrayContaining(["bounties", "submissions", "events"]));

    const insert = db.prepare(`INSERT INTO bounties
      (id, title, description, amount_sats, status, payment_hash, hold_invoice, preimage, poster_secret, expires_at, created_at)
      VALUES (@id, 't', 'd', 1000, @status, @hash, 'lnbcrt1...', 'pre', 'sec', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`);
    expect(() => insert.run({ id: "b1", status: "unfunded", hash: "h1" })).not.toThrow();
    expect(() => insert.run({ id: "b2", status: "bogus", hash: "h2" })).toThrow(/CHECK/);
    expect(() => insert.run({ id: "b3", status: "unfunded", hash: "h1" })).toThrow(/UNIQUE/);
  });
});
