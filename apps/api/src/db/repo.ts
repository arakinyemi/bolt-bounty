import type { Bounty, BountyStatus, Submission } from "@boltbounty/shared";
import type { Db } from "./index.js";

// Thin query layer. Rows are snake_case in SQLite and camelCase in code; the
// two helpers below convert generically so each query stays one line.

export interface BountyRecord extends Bounty {
  preimage: string; // never leaves the API
}

const WATCHED: BountyStatus[] = ["unfunded", "funded", "submitted"];

const snake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const camel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

function fromRow<T>(row: unknown): T {
  return Object.fromEntries(Object.entries(row as Record<string, unknown>).map(([k, v]) => [camel(k), v])) as T;
}

function insert(db: Db, table: string, rec: object): void {
  const keys = Object.keys(rec);
  db.prepare(`INSERT INTO ${table} (${keys.map(snake).join(", ")}) VALUES (${keys.map((k) => `@${k}`).join(", ")})`).run(rec as Record<string, unknown>);
}

function update(db: Db, table: string, id: string, patch: object): void {
  const keys = Object.keys(patch);
  if (keys.length === 0) return;
  db.prepare(`UPDATE ${table} SET ${keys.map((k) => `${snake(k)} = @${k}`).join(", ")} WHERE id = @id`).run({ ...patch, id });
}

export const bounties = {
  insert: (db: Db, rec: BountyRecord) => insert(db, "bounties", rec),
  get: (db: Db, id: string): BountyRecord | undefined => {
    const row = db.prepare("SELECT * FROM bounties WHERE id = ?").get(id);
    return row ? fromRow<BountyRecord>(row) : undefined;
  },
  list: (db: Db): BountyRecord[] =>
    db.prepare("SELECT * FROM bounties ORDER BY created_at DESC").all().map((r) => fromRow<BountyRecord>(r)),
  watched: (db: Db): BountyRecord[] =>
    db.prepare(`SELECT * FROM bounties WHERE status IN (${WATCHED.map(() => "?").join(",")})`).all(...WATCHED).map((r) => fromRow<BountyRecord>(r)),
  update: (db: Db, id: string, patch: Partial<Pick<BountyRecord, "status" | "fundedAt" | "payoutPaymentHash">>) =>
    update(db, "bounties", id, patch),
};

export const submissions = {
  insert: (db: Db, rec: Submission) => insert(db, "submissions", rec),
  get: (db: Db, id: string): Submission | undefined => {
    const row = db.prepare("SELECT * FROM submissions WHERE id = ?").get(id);
    return row ? fromRow<Submission>(row) : undefined;
  },
  forBounty: (db: Db, bountyId: string): Submission[] =>
    db.prepare("SELECT * FROM submissions WHERE bounty_id = ? ORDER BY created_at ASC").all(bountyId).map((r) => fromRow<Submission>(r)),
  update: (db: Db, id: string, patch: Partial<Pick<Submission, "decidedAt" | "decision" | "payoutError">>) =>
    update(db, "submissions", id, patch),
};

export const events = {
  insert: (db: Db, bountyId: string, type: string, payload: Record<string, unknown> = {}) =>
    insert(db, "events", { bountyId, type, payload: JSON.stringify(payload), createdAt: new Date().toISOString() }),
};
