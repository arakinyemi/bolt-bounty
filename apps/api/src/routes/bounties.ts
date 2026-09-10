import { createBountySchema, createSubmissionSchema, decisionSchema } from "@boltbounty/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ZodType } from "zod";
import { currentUser } from "../auth.js";
import * as svc from "../bounties/service.js";
import type { Ctx } from "../bounties/service.js";

type IdParams = { Params: { id: string } };

function parse<T>(schema: ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
    throw new svc.HttpError(400, issues);
  }
  return result.data;
}

function posterSecret(req: FastifyRequest): string | undefined {
  const h = req.headers["x-poster-secret"];
  return Array.isArray(h) ? h[0] : h;
}

export function registerBountyRoutes(app: FastifyInstance, ctx: Ctx): void {
  // Loads the bounty and checks the caller is its poster.
  const asPoster = (req: FastifyRequest<IdParams>) => {
    const b = svc.mustGet(ctx, req.params.id);
    svc.requirePoster(b, currentUser(ctx.db, req), posterSecret(req));
    return b;
  };

  app.post("/bounties", async (req, reply) => {
    const input = parse(createBountySchema, req.body);
    const b = await svc.createBounty(ctx, input, currentUser(ctx.db, req));
    // The only response that ever contains the poster secret.
    const { preimage: _p, ...withSecret } = b;
    return reply.code(201).send(withSecret);
  });

  app.get("/bounties", async () => svc.listBounties(ctx));

  app.get<IdParams>("/bounties/:id", async (req) => svc.getDetail(ctx, req.params.id));

  app.post<IdParams>("/bounties/:id/submissions", async (req, reply) => {
    const input = parse(createSubmissionSchema, req.body);
    const s = await svc.submitWork(ctx, req.params.id, input, currentUser(ctx.db, req));
    return reply.code(201).send(s);
  });

  app.post<IdParams>("/bounties/:id/approve", async (req) => {
    const b = asPoster(req);
    const { submissionId } = parse(decisionSchema, req.body);
    return svc.toPublic(await svc.approve(ctx, b.id, submissionId));
  });

  app.post<IdParams>("/bounties/:id/reject", async (req) => {
    const b = asPoster(req);
    const { submissionId } = parse(decisionSchema, req.body);
    return svc.toPublic(svc.reject(ctx, b.id, submissionId));
  });

  app.post<IdParams>("/bounties/:id/cancel", async (req) => svc.toPublic(await svc.cancel(ctx, asPoster(req).id)));

  app.post<IdParams>("/bounties/:id/retry-payout", async (req) => svc.toPublic(await svc.retryPayout(ctx, asPoster(req).id)));

  // Server-sent events. /events streams every bounty (for the board);
  // /bounties/:id/events streams one.
  app.get("/events", (req, reply) => stream(ctx, req, reply, null));
  app.get<IdParams>("/bounties/:id/events", (req, reply) => {
    svc.mustGet(ctx, req.params.id);
    stream(ctx, req, reply, req.params.id);
  });
}

function stream(ctx: Ctx, req: FastifyRequest, reply: FastifyReply, bountyId: string | null): void {
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  reply.raw.write(`event: ready\ndata: {}\n\n`);
  const unsubscribe = ctx.hub.subscribe((change) => {
    if (bountyId && change.bountyId !== bountyId) return;
    reply.raw.write(`event: status\ndata: ${JSON.stringify(change)}\n\n`);
  });
  const heartbeat = setInterval(() => reply.raw.write(`: ping\n\n`), 15_000);
  req.raw.on("close", () => {
    unsubscribe();
    clearInterval(heartbeat);
  });
}
