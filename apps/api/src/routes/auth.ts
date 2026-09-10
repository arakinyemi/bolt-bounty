import { roleSchema, type MeResponse } from "@boltbounty/shared";
import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { SESSION_COOKIE, cookieOptions, createSession, currentUser, requireUser, setSessionCookie, toPublicUser } from "../auth.js";
import { HttpError, type Ctx } from "../bounties/service.js";
import { config } from "../config.js";
import { sessions, submissions, users } from "../db/repo.js";
import { github } from "../github/api.js";
import { authorizeUrl, exchangeCode } from "../github/oauth.js";

const STATE_COOKIE = "bb_oauth_state";

// Only same-origin paths may be used as a post-login destination.
function safeReturnTo(value: unknown): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export function registerAuthRoutes(app: FastifyInstance, ctx: Ctx): void {
  app.get("/me", async (req): Promise<MeResponse> => {
    const user = currentUser(ctx.db, req);
    return { user: user ? toPublicUser(user) : null, githubConfigured: config.github !== null };
  });

  app.get<{ Querystring: { returnTo?: string } }>("/auth/github", async (req, reply) => {
    if (!config.github) throw new HttpError(503, "GitHub sign-in is not configured on this server");
    const state = randomBytes(16).toString("hex");
    reply.setCookie(STATE_COOKIE, `${state}:${safeReturnTo(req.query.returnTo)}`, { ...cookieOptions, maxAge: 600 });
    return reply.redirect(authorizeUrl(state));
  });

  app.get<{ Querystring: { code?: string; state?: string; error_description?: string } }>("/auth/github/callback", async (req, reply) => {
    const [expectedState = "", returnTo = "/"] = (req.cookies[STATE_COOKIE] ?? "").split(":", 2);
    reply.clearCookie(STATE_COOKIE, cookieOptions);
    if (!req.query.code || !req.query.state || req.query.state !== expectedState) {
      throw new HttpError(400, req.query.error_description ?? "GitHub sign-in was cancelled or the state did not match");
    }
    const token = await exchangeCode(req.query.code);
    const gh = await github.user(token);
    const user = users.upsert(ctx.db, {
      id: String(gh.id),
      login: gh.login,
      name: gh.name,
      avatarUrl: gh.avatar_url,
      accessToken: token,
    });
    setSessionCookie(reply, createSession(ctx.db, user.id));
    return reply.redirect(`${config.appUrl}${safeReturnTo(returnTo)}`);
  });

  app.post("/me/role", async (req) => {
    const user = requireUser(ctx.db, req);
    const parsed = roleSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "role must be poster or worker");
    if (user.role && user.role !== parsed.data.role && users.hasActivity(ctx.db, user.id)) {
      throw new HttpError(409, "this account already has bounties or submissions, so its role is fixed");
    }
    users.setRole(ctx.db, user.id, parsed.data.role);
    return toPublicUser(users.get(ctx.db, user.id)!);
  });

  // The signed-in worker's submissions with their bounties, for "My work".
  app.get("/me/submissions", async (req) => submissions.forWorker(ctx.db, requireUser(ctx.db, req).id));

  app.post("/auth/logout", async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE];
    if (token) sessions.delete(ctx.db, token);
    reply.clearCookie(SESSION_COOKIE, cookieOptions);
    return { ok: true };
  });

  // GitHub data for the signed-in user: repos to post against, and open pull
  // requests on a bounty's repo to submit.
  app.get("/github/repos", async (req) => github.repos(requireUser(ctx.db, req).accessToken));

  app.get<{ Params: { owner: string; repo: string } }>("/github/repos/:owner/:repo/pulls", async (req) => {
    const user = requireUser(ctx.db, req);
    return github.pulls(user.accessToken, `${req.params.owner}/${req.params.repo}`, user.login);
  });

  app.get<{ Params: { owner: string; repo: string } }>("/github/repos/:owner/:repo/issues", async (req) =>
    github.issues(requireUser(ctx.db, req).accessToken, `${req.params.owner}/${req.params.repo}`));

  app.get<{ Params: { owner: string; repo: string; number: string } }>("/github/repos/:owner/:repo/issues/:number", async (req) =>
    github.issue(requireUser(ctx.db, req).accessToken, `${req.params.owner}/${req.params.repo}`, Number(req.params.number)));
}
