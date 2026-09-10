# ⚡ BoltBounty

Micro-bounties escrowed on Lightning. The poster's sats lock the moment the
bounty is funded, nobody can spend them until the work is approved, and they
return to the poster automatically if nobody delivers.

Hackathon MVP. Regtest only.

## The problem

Small pieces of work (fix a bug, write docs, translate a page, label a
dataset) are hard to pay for. Platforms take 10 to 20 percent, minimum payouts
are high, and cross-border payouts to workers in Nigeria and elsewhere are slow
or blocked. Posters have no cheap way to prove the money exists before someone
starts working.

## The solution

A bounty board where funding is a Lightning **hold invoice**. Paying it locks
the sats in flight on the poster's own channel. The platform cannot spend them
and the poster cannot pull them back until the bounty expires.

- **Approve**: the platform settles the hold invoice with the preimage and pays
  the worker's invoice. Seconds, near-zero fee, anywhere in the world.
- **Reject or expire**: the platform cancels the hold invoice. The poster's
  payment fails back along the route. No refund transaction ever exists.

## Why Lightning, not decoration

- Hold invoices give escrow without a smart contract, a custodian, or a
  settlement layer. The lock is a property of the HTLC itself.
- Amounts from 500 to 50,000 sats are viable because fees are near zero.
- Payout is global and final in seconds. A worker in Lagos and a poster in
  Lisbon need no shared bank.

## Architecture

```
  poster node ──── channel ────► platform node ◄──── channel ──── worker node
  (pays hold          ▲          (LND, regtest)                    (issues payout
   invoice)           │                ▲                            invoice)
                      │                │ REST + macaroon
                      │                │
               Polar UI          apps/api  (Fastify, TypeScript)
                                  ├── lnd/       hold invoice, settle, cancel, pay
                                  ├── bounties/  state machine + service
                                  ├── watcher    polls invoice state every 3s
                                  └── SQLite     data/boltbounty.db
                                       ▲
                                       │ JSON + server-sent events
                                       │
                                  apps/web  (React, Vite, Tailwind)
                                  board · create · bounty detail · how it works
```

The web app only talks to the API. The API only talks to the platform node.
The poster and worker nodes are driven from Polar during the demo.

### Lifecycle

| Step | LND call on platform node | Bounty status |
|---|---|---|
| Create | `AddHoldInvoice(sha256(preimage))` | unfunded |
| Poster pays | watcher sees invoice `ACCEPTED` | funded |
| Worker submits | `DecodePayReq` to check the payout amount | submitted |
| Approve | `SettleInvoice(preimage)` then `SendPaymentV2(worker invoice)` | paid |
| Reject | none, escrow stays locked | funded |
| Cancel or expire | `CancelInvoice(hash)` | cancelled / expired |

Status changes happen in one place, `apps/api/src/bounties/state.ts`.

## Setup

Requirements: Node 20+, pnpm, Docker, [Polar](https://lightningpolar.com).

1. In Polar create a regtest network with three LND nodes named `poster`,
   `platform`, `worker`. Fund poster and platform, open channels poster to
   platform and platform to worker at 1,000,000 sats each. See
   [docs/polar.md](docs/polar.md) for the ports and file paths.
2. `cp .env.example .env` and fill in the platform node's REST host, TLS cert
   path, and admin macaroon as hex.
3. `pnpm install`
4. `pnpm lnd:check` should print the platform node's alias and two channels.
5. `pnpm lnd:hodl-smoke` proves the escrow mechanic: pay the printed invoice
   from poster in Polar, then choose settle or cancel.
6. `pnpm dev` and open http://localhost:5173.

`pnpm test` runs the unit tests and a live suite that drives the whole
lifecycle across the Polar network. `pnpm demo:reset` cancels open hold
invoices and clears the database. The demo run sheet is in
[docs/demo.md](docs/demo.md).

## What we would build next

- **Trustless payout.** The worker generates the preimage and the poster's
  hold invoice uses the worker's hash. Approval reveals the preimage and settles
  both legs atomically, with no platform custody at all.
- **Lightning Address and LNURL-pay** for workers, so nobody pastes invoices.
- **Competing submissions** with partial splits.
- **Nostr login and reputation.**
- **Mainnet** with a 1 percent platform fee taken as a separate invoice, so
  escrow amounts stay exact.

## Out of scope for the MVP

Accounts and login, reputation, disputes, multiple competing submissions,
Lightning Address payout, mainnet, mobile.
