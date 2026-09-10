import type { BountyDetail, CreateBountyInput, CreateSubmissionInput, PublicBounty, Submission } from "@boltbounty/shared";
import { randomBytes, randomUUID } from "node:crypto";
import { config } from "../config.js";
import type { Db } from "../db/index.js";
import { bounties, events, submissions, type BountyRecord } from "../db/repo.js";
import type { Hub } from "../events/hub.js";
import { lnd } from "../lnd/client.js";
import { newPreimage } from "../lnd/preimage.js";
import { transition, type BountyEvent } from "./state.js";

// Every bounty operation lives here. Routes validate and call in; the watcher
// calls in; nothing else touches LND or the state machine.

export interface Ctx {
  db: Db;
  hub: Hub;
}

export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

export function toPublic(b: BountyRecord): PublicBounty {
  const { preimage: _p, posterSecret: _s, ...rest } = b;
  return rest;
}

export function mustGet(ctx: Ctx, id: string): BountyRecord {
  const b = bounties.get(ctx.db, id);
  if (!b) throw new HttpError(404, "bounty not found");
  return b;
}

export function requirePoster(b: BountyRecord, secret: string | undefined): void {
  if (!secret || secret !== b.posterSecret) throw new HttpError(403, "invalid poster secret");
}

// Applies a state-machine event, persists it, and notifies SSE subscribers.
// Returns the updated bounty.
export function apply(ctx: Ctx, b: BountyRecord, event: BountyEvent, patch: Partial<Pick<BountyRecord, "fundedAt" | "payoutPaymentHash">> = {}): BountyRecord {
  const to = transition(b, event);
  bounties.update(ctx.db, b.id, { status: to, ...patch });
  events.insert(ctx.db, b.id, event, { from: b.status, to, ...patch });
  const updated = mustGet(ctx, b.id);
  ctx.hub.publish({ bountyId: b.id, from: b.status, to, event, at: new Date().toISOString(), bounty: toPublic(updated) });
  return updated;
}

export async function createBounty(ctx: Ctx, input: CreateBountyInput): Promise<BountyRecord> {
  const { preimage, hash } = newPreimage();
  const expiresIn = input.expiresInSeconds ?? config.bountyDefaultExpirySeconds;
  const holdInvoice = await lnd.addHoldInvoice({
    hash,
    valueSats: input.amountSats,
    memo: `BoltBounty: ${input.title.slice(0, 60)}`,
    expirySeconds: expiresIn,
    cltvExpiry: config.holdInvoiceCltvExpiry,
  });
  const now = Date.now();
  const rec: BountyRecord = {
    id: randomUUID(),
    title: input.title,
    description: input.description,
    repoUrl: input.repoUrl ?? null,
    amountSats: input.amountSats,
    status: "unfunded",
    paymentHash: hash,
    holdInvoice,
    preimage,
    posterSecret: randomBytes(16).toString("hex"),
    fundedAt: null,
    expiresAt: new Date(now + expiresIn * 1000).toISOString(),
    createdAt: new Date(now).toISOString(),
    payoutPaymentHash: null,
  };
  bounties.insert(ctx.db, rec);
  events.insert(ctx.db, rec.id, "created", { paymentHash: hash, amountSats: rec.amountSats });
  return rec;
}

export function listBounties(ctx: Ctx): PublicBounty[] {
  return bounties.list(ctx.db).map(toPublic);
}

export function getDetail(ctx: Ctx, id: string): BountyDetail {
  return { ...toPublic(mustGet(ctx, id)), submissions: submissions.forBounty(ctx.db, id) };
}

export async function submitWork(ctx: Ctx, id: string, input: CreateSubmissionInput): Promise<Submission> {
  const b = mustGet(ctx, id);
  if (b.status !== "funded") throw new HttpError(409, `bounty is ${b.status}, submissions need it funded`);
  const decoded = await lnd.decodeInvoice(input.payoutInvoice);
  if (decoded.amountSats !== b.amountSats) {
    throw new HttpError(400, `payout invoice is for ${decoded.amountSats} sats, bounty pays ${b.amountSats}`);
  }
  if (new Date(decoded.expiresAt).getTime() < Date.now() + 60_000) {
    throw new HttpError(400, "payout invoice expires too soon");
  }
  const sub: Submission = {
    id: randomUUID(),
    bountyId: b.id,
    workerName: input.workerName,
    workUrl: input.workUrl,
    notes: input.notes,
    payoutInvoice: input.payoutInvoice,
    createdAt: new Date().toISOString(),
    decidedAt: null,
    decision: null,
    payoutError: null,
  };
  submissions.insert(ctx.db, sub);
  apply(ctx, b, "submission_received");
  return sub;
}

function pendingSubmission(ctx: Ctx, b: BountyRecord, submissionId: string): Submission {
  const s = submissions.get(ctx.db, submissionId);
  if (!s || s.bountyId !== b.id) throw new HttpError(404, "submission not found");
  return s;
}

// Settle first, then pay. If the payout fails the escrow is already released
// to the platform node, so the bounty stays "submitted" with the error on the
// submission and retryPayout can finish the job.
export async function approve(ctx: Ctx, id: string, submissionId: string): Promise<BountyRecord> {
  const b = mustGet(ctx, id);
  if (b.status !== "submitted") throw new HttpError(409, `bounty is ${b.status}, nothing to approve`);
  const s = pendingSubmission(ctx, b, submissionId);
  if (s.decision) throw new HttpError(409, `submission already ${s.decision}`);

  await lnd.settleInvoice(b.preimage);
  submissions.update(ctx.db, s.id, { decision: "approved", decidedAt: new Date().toISOString() });
  events.insert(ctx.db, b.id, "hold_invoice_settled", { paymentHash: b.paymentHash });
  return payWorker(ctx, b, s);
}

export async function retryPayout(ctx: Ctx, id: string): Promise<BountyRecord> {
  const b = mustGet(ctx, id);
  if (b.status !== "submitted") throw new HttpError(409, `bounty is ${b.status}, nothing to retry`);
  const s = submissions.forBounty(ctx.db, id).find((x) => x.decision === "approved" && x.payoutError);
  if (!s) throw new HttpError(409, "no approved submission with a failed payout");
  return payWorker(ctx, b, s);
}

async function payWorker(ctx: Ctx, b: BountyRecord, s: Submission): Promise<BountyRecord> {
  const feeLimitSats = Math.max(10, Math.ceil(b.amountSats / 100));
  try {
    const paid = await lnd.payInvoice(s.payoutInvoice, feeLimitSats);
    submissions.update(ctx.db, s.id, { payoutError: null });
    return apply(ctx, b, "approved", { payoutPaymentHash: paid.paymentHash });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    submissions.update(ctx.db, s.id, { payoutError: message });
    events.insert(ctx.db, b.id, "payout_failed", { error: message });
    throw new HttpError(502, `hold invoice settled but payout failed: ${message}. Retry with POST /bounties/${b.id}/retry-payout`);
  }
}

export function reject(ctx: Ctx, id: string, submissionId: string): BountyRecord {
  const b = mustGet(ctx, id);
  if (b.status !== "submitted") throw new HttpError(409, `bounty is ${b.status}, nothing to reject`);
  const s = pendingSubmission(ctx, b, submissionId);
  if (s.decision) throw new HttpError(409, `submission already ${s.decision}`);
  submissions.update(ctx.db, s.id, { decision: "rejected", decidedAt: new Date().toISOString() });
  return apply(ctx, b, "rejected");
}

export async function cancel(ctx: Ctx, id: string): Promise<BountyRecord> {
  const b = mustGet(ctx, id);
  if (b.status !== "funded") throw new HttpError(409, `bounty is ${b.status}, only funded bounties can be cancelled`);
  await lnd.cancelInvoice(b.paymentHash);
  return apply(ctx, b, "poster_cancelled");
}
