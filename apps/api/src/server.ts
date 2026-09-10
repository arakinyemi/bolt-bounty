import Fastify, { type FastifyInstance } from "fastify";
import { IllegalTransition } from "./bounties/state.js";
import { HttpError, type Ctx } from "./bounties/service.js";
import { config } from "./config.js";
import { openDb } from "./db/index.js";
import { Hub } from "./events/hub.js";
import { lnd } from "./lnd/client.js";
import { LndError } from "./lnd/rest.js";
import { startWatcher } from "./lnd/watcher.js";
import { registerBountyRoutes } from "./routes/bounties.js";

export function buildApp(ctx: Ctx): FastifyInstance {
  const app = Fastify({ logger: { level: "warn" } });
  app.setErrorHandler((err: unknown, _req, reply) => {
    if (err instanceof HttpError) return reply.code(err.status).send({ error: err.message });
    if (err instanceof IllegalTransition) return reply.code(409).send({ error: err.message });
    if (err instanceof LndError) return reply.code(502).send({ error: err.message });
    // Fastify's own client errors, e.g. malformed JSON, carry a statusCode.
    const fastifyErr = err as { statusCode?: number; message?: string };
    if (typeof fastifyErr.statusCode === "number" && fastifyErr.statusCode < 500) {
      return reply.code(fastifyErr.statusCode).send({ error: fastifyErr.message });
    }
    app.log.error(err);
    return reply.code(500).send({ error: "internal error" });
  });
  app.get("/health", async () => ({ ok: true }));
  registerBountyRoutes(app, ctx);
  return app;
}

// Entry point for `pnpm dev`. Tests import buildApp and start their own watcher.
if (process.argv[1]?.endsWith("server.ts")) {
  const info = await lnd.getInfo(); // fail loudly if the platform node is down
  console.log(`[api] platform node ${info.alias} (${info.identity_pubkey.slice(0, 16)}…) on ${info.chains[0]?.network}`);
  const ctx: Ctx = { db: openDb(config.databasePath), hub: new Hub() };
  const app = buildApp(ctx);
  const stopWatcher = startWatcher(ctx);
  app.addHook("onClose", async () => stopWatcher());
  await app.listen({ port: config.port, host: "127.0.0.1" });
  console.log(`[api] listening on http://127.0.0.1:${config.port}`);
}
