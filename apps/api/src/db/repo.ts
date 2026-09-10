import type { Bounty, BountyStatus, Submission } from "@boltbounty/shared";
import type { Db } from "./index.js";

// Thin query layer. Rows are snake_case in SQLite and camelCase in code; the
// two helpers below convert generically so each query stays one line.

export interface BountyRecord extends Bounty {
  preimage: string; // never leaves the API
}

export interface UserRecord {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string;
  accessToken: string; // never leaves the API
  createdAt: string;
  updatedAt: string;
}

export interface SessionRecord {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
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

// Bounties and submissions carry a small joined view of their GitHub user.
const BOUNTY_SELECT = `SELECT b.*, u.login AS poster_login, u.avatar_url AS poster_avatar_url
  FROM bounties b LEFT JOIN users u ON u.id = b.poster_user_id`;
const SUBMISSION_SELECT = `SELECT s.*, u.login AS worker_login, u.avatar_url AS worker_avatar_url
  FROM submissions s LEFT JOIN users u ON u.id = s.worker_user_id`;

function toBounty(row: unknown): BountyRecord {
  const { posterLogin, posterAvatarUrl, ...rest } = fromRow<BountyRecord & { posterLogin: string | null; posterAvatarUrl: string | null }>(row);
  return { ...rest, poster: posterLogin && posterAvatarUrl ? { login: posterLogin, avatarUrl: posterAvatarUrl } : null };
}

function toSubmission(row: unknown): Submission {
  const { workerLogin, workerAvatarUrl, ...rest } = fromRow<Submission & { workerLogin: string | null; workerAvatarUrl: string | null }>(row);
  return { ...rest, worker: workerLogin && workerAvatarUrl ? { login: workerLogin, avatarUrl: workerAvatarUrl } : null };
}

export const bounties = {
  insert: (db: Db, rec: BountyRecord) => {
    const { poster: _joined, ...row } = rec;
    insert(db, "bounties", row);
  },
  get: (db: Db, id: string): BountyRecord | undefined => {
    const row = db.prepare(`${BOUNTY_SELECT} WHERE b.id = ?`).get(id);
    return row ? toBounty(row) : undefined;
  },
  list: (db: Db): BountyRecord[] => db.prepare(`${BOUNTY_SELECT} ORDER BY b.created_at DESC`).all().map(toBounty),
  watched: (db: Db): BountyRecord[] =>
    db.prepare(`${BOUNTY_SELECT} WHERE b.status IN (${WATCHED.map(() => "?").join(",")})`).all(...WATCHED).map(toBounty),
  update: (db: Db, id: string, patch: Partial<Pick<BountyRecord, "status" | "fundedAt" | "payoutPaymentHash">>) =>
    update(db, "bounties", id, patch),
};

export const submissions = {
  insert: (db: Db, rec: Submission) => {
    const { worker: _joined, ...row } = rec;
    insert(db, "submissions", row);
  },
  get: (db: Db, id: string): Submission | undefined => {
    const row = db.prepare(`${SUBMISSION_SELECT} WHERE s.id = ?`).get(id);
    return row ? toSubmission(row) : undefined;
  },
  forBounty: (db: Db, bountyId: string): Submission[] =>
    db.prepare(`${SUBMISSION_SELECT} WHERE s.bounty_id = ? ORDER BY s.created_at ASC`).all(bountyId).map(toSubmission),
  update: (db: Db, id: string, patch: Partial<Pick<Submission, "decidedAt" | "decision" | "payoutError">>) =>
    update(db, "submissions", id, patch),
};

export const events = {
  insert: (db: Db, bountyId: string, type: string, payload: Record<string, unknown> = {}) =>
    insert(db, "events", { bountyId, type, payload: JSON.stringify(payload), createdAt: new Date().toISOString() }),
};

export const users = {
  get: (db: Db, id: string): UserRecord | undefined => {
    const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
    return row ? fromRow<UserRecord>(row) : undefined;
  },
  upsert: (db: Db, u: Omit<UserRecord, "createdAt" | "updatedAt">): UserRecord => {
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO users (id, login, name, avatar_url, access_token, created_at, updated_at)
      VALUES (@id, @login, @name, @avatarUrl, @accessToken, @now, @now)
      ON CONFLICT(id) DO UPDATE SET login = excluded.login, name = excluded.name,
        avatar_url = excluded.avatar_url, access_token = excluded.access_token, updated_at = excluded.updated_at`).run({ ...u, now });
    return users.get(db, u.id)!;
  },
};

export const sessions = {
  insert: (db: Db, s: SessionRecord) => insert(db, "sessions", s),
  get: (db: Db, token: string): SessionRecord | undefined => {
    const row = db.prepare("SELECT * FROM sessions WHERE token = ?").get(token);
    return row ? fromRow<SessionRecord>(row) : undefined;
  },
  delete: (db: Db, token: string) => db.prepare("DELETE FROM sessions WHERE token = ?").run(token),
};
