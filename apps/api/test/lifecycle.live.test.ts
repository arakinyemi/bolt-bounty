import type { Bounty, BountyDetail, PublicBounty, StatusChange, Submission } from "@boltbounty/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSession } from "../src/auth.js";
import { openDb } from "../src/db/index.js";
import { users } from "../src/db/repo.js";
import { Hub } from "../src/events/hub.js";
import { lnd } from "../src/lnd/client.js";
import { pollOnce, startWatcher } from "../src/lnd/watcher.js";
import { buildApp } from "../src/server.js";
import { PolarNode, waitFor } from "./helpers/polar-node.js";

// Runs against the live Polar network. The poster and worker nodes are driven
// through their own REST APIs exactly as a human drives them in Polar.

const poster = PolarNode.fromEnv("POSTER");
const worker = PolarNode.fromEnv("WORKER");
const ctx = { db: openDb(":memory:"), hub: new Hub() };
const app = buildApp(ctx);
let base = "";
let stopWatcher = () => {};
// A signed-in worker, seeded directly so the suite needs no GitHub OAuth app.
const worker_user = users.upsert(ctx.db, { id: "1", login: "ada", name: "Ada", avatarUrl: "https://example.invalid/ada.png", accessToken: "test-token" });
const workerCookie = { cookie: `bb_session=${createSession(ctx.db, worker_user.id)}` };

beforeAll(async () => {
  await app.listen({ port: 0, host: "127.0.0.1" });
  const addr = app.server.address();
  base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
  stopWatcher = startWatcher(ctx, 500);
});

afterAll(async () => {
  stopWatcher();
  await app.close();
});

async function api<T>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<{ status: number; body: T }> {
  const res = await fetch(base + "/api" + path, {
    method,
    headers: body === undefined ? headers : { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as T };
}

const detail = (id: string) => api<BountyDetail>("GET", `/bounties/${id}`).then((r) => r.body);

async function createBounty(amountSats: number): Promise<Bounty> {
  const res = await api<Bounty>("POST", "/bounties", {
    title: "Fix broken link in README",
    description: "The docs link 404s.",
    repoUrl: "https://github.com/example/repo",
    amountSats,
  });
  expect(res.status).toBe(201);
  expect(res.body.status).toBe("unfunded");
  expect(res.body.posterSecret).toMatch(/^[0-9a-f]{32}$/);
  expect(res.body.holdInvoice).toMatch(/^lnbcrt/);
  expect(res.body).not.toHaveProperty("preimage");
  return res.body;
}

// Reads the bounty's SSE stream in the background and collects transitions.
function collectEvents(id: string): { seen: StatusChange[]; stop: () => void } {
  const seen: StatusChange[] = [];
  const controller = new AbortController();
  (async () => {
    const res = await fetch(`${base}/api/bounties/${id}/events`, { signal: controller.signal });
    const decoder = new TextDecoder();
    let buffer = "";
    for await (const chunk of res.body!) {
      buffer += decoder.decode(chunk, { stream: true });
      for (const line of buffer.split("\n")) {
        if (line.startsWith("data: ") && line !== "data: {}") seen.push(JSON.parse(line.slice(6)));
      }
      buffer = buffer.slice(buffer.lastIndexOf("\n") + 1);
    }
  })().catch(() => {});
  return { seen, stop: () => controller.abort() };
}

describe("bounty lifecycle on Polar", () => {
  it("create, fund, submit, approve: worker is paid amountSats", async () => {
    const amountSats = 20_000;
    const workerBefore = await worker.channelLocalSats();
    const bounty = await createBounty(amountSats);
    const events = collectEvents(bounty.id);

    const list = await api<PublicBounty[]>("GET", "/bounties");
    expect(list.body[0]?.id).toBe(bounty.id);
    expect(list.body[0]).not.toHaveProperty("posterSecret");

    const payment = poster.pay(bounty.holdInvoice);
    await payment.inFlight;
    const funded = await waitFor("funded", () => detail(bounty.id), (b) => b.status === "funded");
    expect(funded.fundedAt).not.toBeNull();

    const wrongAmount = await api<{ error: string }>("POST", `/bounties/${bounty.id}/submissions`, {
      workUrl: "https://github.com/example/repo/pull/1",
      notes: "",
      payoutInvoice: await worker.createInvoice(amountSats - 1),
    }, workerCookie);
    expect(wrongAmount.status).toBe(400);
    expect(wrongAmount.body.error).toMatch(/19999 sats/);

    const submitWork = async () => api<Submission>("POST", `/bounties/${bounty.id}/submissions`, {
      workUrl: "https://github.com/example/repo/pull/1",
      notes: "done",
      payoutInvoice: await worker.createInvoice(amountSats),
    }, workerCookie);

    // A rejected submission returns the bounty to funded with escrow intact.
    const first = await submitWork();
    expect(first.status).toBe(201);
    expect((await detail(bounty.id)).status).toBe("submitted");
    const rejected = await api<PublicBounty>("POST", `/bounties/${bounty.id}/reject`, { submissionId: first.body.id }, { "x-poster-secret": bounty.posterSecret });
    expect(rejected.body.status).toBe("funded");
    expect((await lnd.lookupInvoice(bounty.paymentHash)).state).toBe("ACCEPTED");

    const submitted = await submitWork();
    expect(submitted.status).toBe(201);

    const noSecret = await api("POST", `/bounties/${bounty.id}/approve`, { submissionId: submitted.body.id });
    expect(noSecret.status).toBe(403);

    const approved = await api<PublicBounty>("POST", `/bounties/${bounty.id}/approve`, { submissionId: submitted.body.id }, { "x-poster-secret": bounty.posterSecret });
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe("paid");
    expect(approved.body.payoutPaymentHash).toMatch(/^[0-9a-f]{64}$/);

    expect(await payment.final).toBe("SUCCEEDED");
    await waitFor("worker balance", () => worker.channelLocalSats(), (v) => v === workerBefore + amountSats);

    const after = await detail(bounty.id);
    expect(after.submissions.map((s) => s.decision)).toEqual(["rejected", "approved"]);
    expect(after.submissions[1]?.worker?.login).toBe("ada");
    expect(after.submissions[1]?.workerName).toBe("ada");
    expect(events.seen.map((e) => e.to)).toEqual(["funded", "submitted", "funded", "submitted", "paid"]);
    events.stop();
  });

  it("create, fund, cancel: poster balance is restored without a refund payment", async () => {
    const posterBefore = await poster.channelLocalSats();
    const bounty = await createBounty(5_000);

    const tooEarly = await api<{ error: string }>("POST", `/bounties/${bounty.id}/cancel`, undefined, { "x-poster-secret": bounty.posterSecret });
    expect(tooEarly.status).toBe(409);

    const payment = poster.pay(bounty.holdInvoice);
    await payment.inFlight;
    await waitFor("funded", () => detail(bounty.id), (b) => b.status === "funded");
    expect(await poster.channelLocalSats()).toBeLessThan(posterBefore);

    const cancelled = await api<PublicBounty>("POST", `/bounties/${bounty.id}/cancel`, undefined, { "x-poster-secret": bounty.posterSecret });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.status).toBe("cancelled");

    expect(await payment.final).toBe("FAILED");
    await waitFor("poster balance", () => poster.channelLocalSats(), (v) => v === posterBefore);

    const again = await api("POST", `/bounties/${bounty.id}/cancel`, undefined, { "x-poster-secret": bounty.posterSecret });
    expect(again.status).toBe(409);
  });

  it("watcher expires an unpaid bounty past its expiry and cancels the hold invoice", async () => {
    const bounty = await createBounty(1_000);
    ctx.db.prepare("UPDATE bounties SET expires_at = ? WHERE id = ?").run(new Date(Date.now() - 1000).toISOString(), bounty.id);

    await pollOnce(ctx);

    expect((await detail(bounty.id)).status).toBe("expired");
    expect((await lnd.lookupInvoice(bounty.paymentHash)).state).toBe("CANCELED");
  });
});
