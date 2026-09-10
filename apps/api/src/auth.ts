import type { PublicUser } from "@boltbounty/shared";
import type { FastifyReply, FastifyRequest } from "fastify";
import { randomBytes } from "node:crypto";
import { HttpError } from "./bounties/service.js";
import { config } from "./config.js";
import type { Db } from "./db/index.js";
import { sessions, users, type UserRecord } from "./db/repo.js";

// Cookie sessions backed by the sessions table. The cookie holds only a random
// token; nothing about the user is stored client-side.

export const SESSION_COOKIE = "bb_session";
const SESSION_DAYS = 30;

export const cookieOptions = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  secure: config.appUrl.startsWith("https://"),
};

export function createSession(db: Db, userId: string): string {
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  sessions.insert(db, {
    token,
    userId,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_DAYS * 86_400_000).toISOString(),
  });
  return token;
}

export function setSessionCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: SESSION_DAYS * 86_400 });
}

export function currentUser(db: Db, req: FastifyRequest): UserRecord | null {
  const token = req.cookies[SESSION_COOKIE];
  if (!token) return null;
  const session = sessions.get(db, token);
  if (!session || session.expiresAt < new Date().toISOString()) return null;
  return users.get(db, session.userId) ?? null;
}

export function requireUser(db: Db, req: FastifyRequest): UserRecord {
  const user = currentUser(db, req);
  if (!user) throw new HttpError(401, "sign in with GitHub first");
  return user;
}

export function toPublicUser(u: UserRecord): PublicUser {
  return { id: u.id, login: u.login, name: u.name, avatarUrl: u.avatarUrl, role: u.role };
}

export function requireRole(user: UserRecord, role: "poster" | "worker"): void {
  if (user.role !== role) throw new HttpError(403, `only ${role}s can do that`);
}
