import cookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import fs from "node:fs";
import path from "node:path";
import { IllegalTransition } from "./bounties/state.js";
import { HttpError, type Ctx } from "./bounties/service.js";
import { config } from "./config.js";
import { openDb } from "./db/index.js";
import { Hub } from "./events/hub.js";
import { GithubError } from "./github/api.js";
import { lnd } from "./lnd/client.js";
import { LndError } from "./lnd/rest.js";
import { startWatcher } from "./lnd/watcher.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerBountyRoutes } from "./routes/bounties.js";

// In production the API also serves the built web app from apps/web/dist so
// the whole product is one process behind one origin.
const WEB_DIST = path.resolve(import.meta.dirname, "../../web/dist");

export function buildApp(ctx: Ctx, opts: { serveWeb?: boolean } = {}): FastifyInstance {
  const app = Fastify({ logger: { level: "warn" }, trustProxy: true });
  app.register(cookie);

  app.setErrorHandler((err: unknown, _req, reply) => {
    if (err instanceof HttpError) return reply.code(err.status).send({ error: err.message });
    if (err instanceof IllegalTransition) return reply.code(409).send({ error: err.message });
    if (err instanceof LndError) return reply.code(502).send({ error: err.message });
    if (err instanceof GithubError) return reply.code(502).send({ error: err.message });
    // Fastify's own client errors, e.g. malformed JSON, carry a statusCode.
    const fastifyErr = err as { statusCode?: number; message?: string };
    if (typeof fastifyErr.statusCode === "number" && fastifyErr.statusCode < 500) {
      return reply.code(fastifyErr.statusCode).send({ error: fastifyErr.message });
    }
    app.log.error(err);
    return reply.code(500).send({ error: "internal error" });
  });

  app.register(
    async (api) => {
      api.get("/health", async () => ({ ok: true }));
      registerAuthRoutes(api, ctx);
      registerBountyRoutes(api, ctx);
    },
    { prefix: "/api" },
  );

  if (opts.serveWeb) {
    app.register(fastifyStatic, { root: WEB_DIST, wildcard: false });
    // Client-side routes fall through to the SPA shell.
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api/")) return reply.code(404).send({ error: "not found" });
      return reply.sendFile("index.html");
    });
  }
  return app;
}

// Entry point for `pnpm dev` and `pnpm start`. Tests import buildApp instead.
if (process.argv[1]?.endsWith("server.ts")) {
  const info = await lnd.getInfo(); // fail loudly if the platform node is down
  console.log(`[api] platform node ${info.alias} (${info.identity_pubkey.slice(0, 16)}…) on ${info.chains[0]?.network}`);
  if (!config.github) {
    console.error("[api] GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are required. See README, GitHub integration.");
    process.exit(1);
  }

  const serveWeb = process.env.NODE_ENV === "production" && fs.existsSync(path.join(WEB_DIST, "index.html"));
  const ctx: Ctx = { db: openDb(config.databasePath), hub: new Hub() };
  const app = buildApp(ctx, { serveWeb });
  const stopWatcher = startWatcher(ctx);
  app.addHook("onClose", async () => stopWatcher());
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => app.close().then(() => process.exit(0)));
  }
  await app.listen({ port: config.port, host: process.env.HOST ?? "127.0.0.1" });
  console.log(`[api] listening on http://127.0.0.1:${config.port}${serveWeb ? " and serving apps/web/dist" : ""}`);
}
