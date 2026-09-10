# BoltBounty: Build Plan

Micro-bounties for open-source work and small tasks, escrowed on Lightning with HODL invoices. The poster's sats are locked the moment the bounty is funded, cannot be spent by anyone until the work is approved, and return to the poster automatically if nobody delivers.

This document is the implementation plan. Section 1 is the brief. Sections 2 to 7 are the phased build, each phase ending with acceptance criteria that must pass before moving on. Repo conventions live in CLAUDE.md; the operator prompts live in PROMPT.md.

---

## 1. Project brief

### Problem
Small pieces of work (fix a bug, write docs, translate a page, label a dataset) are hard to pay for. Platforms take 10 to 20 percent, minimum payouts are high, and cross-border payouts to workers in Nigeria and elsewhere are slow or blocked. Posters also have no cheap way to prove the money exists before someone starts working.

### Solution
A bounty board where funding is a Lightning HODL invoice. Paying the invoice locks the sats in-flight on the poster's own channel; the platform cannot spend them and the poster cannot pull them back until the bounty expires. When the poster approves a submission, the platform settles the invoice and pays the worker's Lightning invoice. If the poster rejects or the bounty expires, the HODL invoice is cancelled and the funds unwind to the poster with no transaction ever being made.

### Why Lightning is essential, not decorative
- HODL invoices give escrow without a smart contract, a custodian, or a settlement layer. The lock is a property of the HTLC itself.
- Micro-amounts (500 to 50,000 sats) are viable because fees are near zero.
- Payout is global and final in seconds; a worker in Lagos and a poster in Lisbon need no shared bank.

### MVP scope (what the judges will see working)
1. Poster creates a bounty and receives a HODL invoice.
2. Poster pays it from their node. The board shows the bounty flip from "unfunded" to "funded (escrowed)" the moment the HTLC is accepted.
3. Worker submits a link to the work plus a payout invoice.
4. Poster approves. The HODL invoice settles, the worker's invoice is paid, the board shows "paid" with both payment hashes.
5. Poster rejects (or the bounty expires). The HODL invoice cancels and the poster's node shows the balance restored.

### Explicitly out of scope
Accounts and login, reputation, disputes, multiple submissions competing, Lightning Address payout, mainnet, mobile.

### Stack
- Lightning: Polar regtest, three LND nodes (poster, platform, worker).
- Backend: Node 20, TypeScript, Fastify, better-sqlite3, LND REST API via `fetch` with hex macaroon.
- Frontend: React + TypeScript + Vite, minimal styling (Tailwind), `qrcode.react` for invoices.
- Repo layout: monorepo with `apps/api` and `apps/web`, shared types in `packages/shared`.

---

## 2. Phase 0: Environment and Polar network

**Goal:** a reproducible regtest network the whole build can assume.

Tasks
1. Create a Polar network named `boltbounty` with Bitcoin Core v27+ and three LND nodes: `poster`, `platform`, `worker`. Polar enables `accept-keysend` and the `invoicesrpc` and `routerrpc` sub-servers by default; confirm in each node's `lnd.conf`.
2. Fund the network (Polar "Deposit" on each node, then mine 6 blocks).
3. Open channels: `poster -> platform` 1,000,000 sats and `platform -> worker` 1,000,000 sats. Mine 6 blocks to confirm.
4. Write `docs/polar.md` recording each node's REST host and port, TLS cert path, and admin macaroon path (Polar shows these under Connect).
5. Create `.env.example`:

```
PORT=3000
DATABASE_PATH=./data/boltbounty.db
LND_REST_HOST=https://127.0.0.1:8082
LND_MACAROON_HEX=
LND_TLS_CERT_PATH=
BOUNTY_DEFAULT_EXPIRY_SECONDS=86400
HOLD_INVOICE_CLTV_EXPIRY=400
```

6. Implement `pnpm lnd:check`: calls `GET /v1/getinfo` on the platform node and prints alias, pubkey, and channel count.

Acceptance
- `pnpm lnd:check` prints the platform node's alias and shows 2 active channels.
- `lncli` on the poster node can pay a normal invoice generated on the worker node (proves routing through platform works).

---

## 3. Phase 1: Shared types and state machine

**Goal:** the domain model exists before any HTTP or Lightning code.

`packages/shared/src/types.ts`

```ts
export type BountyStatus =
  | "unfunded"    // HODL invoice created, not yet paid
  | "funded"      // HTLC accepted, sats locked
  | "submitted"   // worker submitted, awaiting poster decision
  | "paid"        // hold invoice settled and worker paid
  | "cancelled"   // poster cancelled or rejected, hold invoice cancelled
  | "expired";    // expiry reached with no approval, hold invoice cancelled

export interface Bounty {
  id: string;
  title: string;
  description: string;
  repoUrl: string | null;
  amountSats: number;
  status: BountyStatus;
  paymentHash: string;
  holdInvoice: string;
  posterSecret: string;        // returned once at creation; acts as poster auth
  fundedAt: string | null;
  expiresAt: string;
  createdAt: string;
  payoutPaymentHash: string | null;
}

export interface Submission {
  id: string;
  bountyId: string;
  workerName: string;
  workUrl: string;
  notes: string;
  payoutInvoice: string;       // BOLT11 from the worker for amountSats
  createdAt: string;
  decidedAt: string | null;
  decision: "approved" | "rejected" | null;
}
```

`apps/api/src/bounties/state.ts` exports one function `transition(bounty, event)` where event is one of `htlc_accepted`, `submission_received`, `approved`, `rejected`, `expired`, `poster_cancelled`. Illegal transitions throw. Table:

| From | Event | To |
|---|---|---|
| unfunded | htlc_accepted | funded |
| unfunded | expired | expired |
| funded | submission_received | submitted |
| funded | poster_cancelled | cancelled |
| funded | expired | expired |
| submitted | approved | paid |
| submitted | rejected | funded |
| submitted | expired | expired |

Rejecting returns the bounty to `funded` so another worker can submit; the escrow stays locked.

SQLite schema in `apps/api/src/db/schema.sql`: tables `bounties`, `submissions`, `events` (id, bounty_id, type, payload JSON, created_at). Preimage is stored in `bounties.preimage` for the MVP; note in the code that production would keep it in a KMS.

Acceptance
- `pnpm test` passes a vitest suite that exercises every row of the table plus three illegal transitions.

---

## 4. Phase 2: LND client

**Goal:** a thin, typed wrapper around the five LND calls the product needs.

`apps/api/src/lnd/client.ts` with these methods, all against the platform node:

| Method | LND REST endpoint | Notes |
|---|---|---|
| `getInfo()` | `GET /v1/getinfo` | health check |
| `addHoldInvoice({ hash, valueSats, memo, expirySeconds, cltvExpiry })` | `POST /v2/invoices/hodl` | hash is base64 in the JSON body |
| `lookupInvoice(hash)` | `GET /v2/invoices/lookup?payment_hash=<hex>` | returns state OPEN / ACCEPTED / SETTLED / CANCELED |
| `settleInvoice(preimage)` | `POST /v2/invoices/settle` | preimage base64 |
| `cancelInvoice(hash)` | `POST /v2/invoices/cancel` | hash base64 |
| `payInvoice(bolt11, feeLimitSats)` | `POST /v2/router/send` | streaming response; read until status SUCCEEDED or FAILED |
| `decodeInvoice(bolt11)` | `GET /v1/payreq/<bolt11>` | used to validate the worker's payout invoice amount |

Implementation notes
- Use Node's global `fetch` with an `https.Agent` (via `undici` Agent) that trusts the TLS cert from `LND_TLS_CERT_PATH`.
- Header `Grpc-Metadata-macaroon: <hex>`.
- `payInvoice` reads the newline-delimited JSON stream; resolve on the first message whose `result.status` is `SUCCEEDED`, reject on `FAILED` with `failure_reason`.
- Preimage generation in `apps/api/src/lnd/preimage.ts`: `crypto.randomBytes(32)`, hash with `crypto.createHash("sha256")`.

Add a script `pnpm lnd:hodl-smoke` that creates a 1,000-sat hold invoice, prints it, polls lookup every 2 seconds, and on ACCEPTED asks (y/n in terminal) whether to settle or cancel. This is the single most important de-risking step in the whole build; do it before writing any HTTP routes.

Acceptance
- Run `pnpm lnd:hodl-smoke`, pay the printed invoice from the poster node in Polar. The poster's Polar UI shows the payment as "in flight", the script reports ACCEPTED. Choose settle: the platform balance increases and the poster payment completes. Repeat and choose cancel: the poster's payment fails and its balance is unchanged.

---

## 5. Phase 3: API

**Goal:** the full bounty lifecycle over HTTP, with LND state kept in sync.

Routes (`apps/api/src/routes/`)

| Method and path | Body / params | Behaviour |
|---|---|---|
| `POST /bounties` | title, description, repoUrl?, amountSats, expiresInSeconds? | generate preimage, create hold invoice, insert bounty as `unfunded`, return bounty including `posterSecret` and `holdInvoice` |
| `GET /bounties` | | list, newest first, secrets and preimages stripped |
| `GET /bounties/:id` | | detail, with submissions, secrets stripped |
| `POST /bounties/:id/submissions` | workerName, workUrl, notes, payoutInvoice | decode invoice, require amount equals amountSats and invoice not expired, require status `funded`, insert, transition to `submitted` |
| `POST /bounties/:id/approve` | header `x-poster-secret`, body submissionId | settle hold invoice, then pay payout invoice, record `payoutPaymentHash`, transition to `paid` |
| `POST /bounties/:id/reject` | header `x-poster-secret`, body submissionId | mark submission rejected, transition back to `funded` |
| `POST /bounties/:id/cancel` | header `x-poster-secret` | require `funded`, cancel hold invoice, transition to `cancelled` |
| `GET /bounties/:id/events` | | server-sent events stream of status changes for live UI |

Invoice watcher (`apps/api/src/lnd/watcher.ts`)
- Every 3 seconds, for every bounty in `unfunded` or `funded` or `submitted`, call `lookupInvoice`.
- OPEN and past `expiresAt`: cancel invoice, transition `expired`.
- ACCEPTED while bounty is `unfunded`: transition `funded`, set `fundedAt`.
- CANCELED while bounty is not already terminal: transition `expired` (covers LND force-cancel near CLTV).
- Emit each transition to the SSE hub.
- Polling is deliberate for the MVP; `SubscribeSingleInvoice` is a next step.

Approve ordering matters. Settle first, then pay. If settle succeeds and payout fails (bad route, worker offline), record the bounty as `paid_pending_payout` is tempting but adds a state. Instead: keep it `submitted`, store the error on the submission, and expose `POST /bounties/:id/retry-payout`. The settled funds are on the platform node so nothing is lost; the demo script avoids this path but the code must handle it.

Validation: use `zod` schemas from `packages/shared`. Amount limits 100 to 1,000,000 sats.

Acceptance
- A vitest integration suite against the live Polar network runs: create, fund (script pays from poster node via its own REST API using a second macaroon), submit, approve, and asserts final status `paid` and worker balance increased by amountSats.
- Second run: create, fund, cancel, and asserts poster node channel balance is unchanged from before funding.

---

## 6. Phase 4: Web app

**Goal:** a board a judge can follow without explanation.

Pages
1. **Board** (`/`): cards with title, amount in sats, status pill, time to expiry. Filter tabs: Open (funded), Submitted, Paid, All.
2. **Create** (`/new`): form; on success shows the hold invoice as QR and text, a "waiting for funding" spinner, and the poster secret with a copy button and a one-line warning to save it. Subscribes to SSE and flips to "Funded and escrowed" live.
3. **Bounty detail** (`/b/:id`): description, repo link, escrow status with the payment hash, list of submissions. Worker panel: submit form (name, work URL, notes, payout invoice). Poster panel: appears when a poster secret for this bounty is in localStorage; shows Approve / Reject per submission and a Cancel bounty button.
4. **Escrow explainer** (`/how`): three-step diagram (lock, deliver, release) and one paragraph on HODL invoices. Judges will read this.

Behaviour
- Status pill colours: unfunded grey, funded amber with a lock icon, submitted blue, paid green, cancelled and expired red.
- Every LND-backed state change shows the relevant hash truncated with a copy button, so the demo can cross-reference Polar.
- No auth beyond the poster secret held in localStorage.

Acceptance
- Full lifecycle completed from the browser with the only non-browser action being paying the hold invoice in Polar.
- Board updates live when the invoice is paid (no manual refresh).

---

## 7. Phase 5: Demo script, docs, and pitch

`docs/demo.md` is the exact sequence for the submission demo. Rehearse it twice.

1. Show Polar: three nodes, two channels, poster balance noted.
2. Create bounty "Fix broken link in README", 20,000 sats.
3. Pay hold invoice from poster node in Polar. Board flips to Funded. Show Polar: poster payment in flight, platform has not received funds. Say: "The sats are locked. Nobody can spend them, including us."
4. As the worker, submit a PR link and a 20,000-sat invoice generated on the worker node.
5. As the poster, approve. Board flips to Paid. Show Polar: worker balance up 20,000, poster payment settled.
6. Create a second bounty, fund it, then cancel. Show Polar: poster's payment failed and balance restored. Say: "Refund without a refund transaction."
7. Open `/how` and the architecture diagram for the technical explanation.

`README.md` covers: problem, solution, why Lightning, architecture diagram (poster node, platform API plus node, worker node, SQLite), setup with Polar, and the "what next" section below.

What we would build next (put this in the README and say it in the pitch)
- Trustless payout: the worker generates the preimage and the poster's hold invoice uses the worker's hash, so approval reveals the preimage and settles both legs atomically with no platform custody.
- Lightning Address and LNURL-pay for workers, so no invoice pasting.
- Multiple competing submissions with partial splits.
- Nostr login and reputation.
- Mainnet with a platform fee of 1 percent, taken as a separate invoice so escrow amounts stay exact.

---

## 8. Risks and how the plan handles them

| Risk | Mitigation |
|---|---|
| HODL invoice behaviour misunderstood | Phase 2 smoke test before any product code |
| LND force-cancels HTLC near CLTV expiry | `HOLD_INVOICE_CLTV_EXPIRY=400` blocks and a rule in CLAUDE.md not to mine during demos |
| Payout fails after settle | Bounty stays `submitted` with error stored; `retry-payout` route |
| Worker invoice for wrong amount | `decodeInvoice` check on submission |
| Demo network state drifts | `scripts/reset-demo.ts` deletes the database and cancels any open hold invoices on the platform node |
| Time | Phases 0 to 3 are the product; Phase 4 can ship with two pages if needed |

---
