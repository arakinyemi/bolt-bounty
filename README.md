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
               Polar UI          apps/api  (Fastify, TypeScript)      GitHub
                                  ├── lnd/       hold invoice, settle, cancel, pay
                                  ├── bounties/  state machine + service     ▲
                                  ├── github/    OAuth, repos, pull requests ─┘
                                  ├── watcher    polls invoice state every 3s
                                  └── SQLite     bounties, submissions, users, sessions
                                       ▲
                                       │ JSON + server-sent events, under /api
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

## Accounts and roles

Everyone signs in with GitHub, and every account is one of two roles, chosen
on first sign-in:

| Role | Can | Sees |
|---|---|---|
| Poster | pick a repo, fund a bounty, approve, reject, cancel | board with a "Mine" tab, post form |
| Worker | claim a funded bounty with one of their open pull requests | board, "My work" with claims and sats earned |

The API enforces the split: only posters create bounties, only workers submit,
a poster can never claim their own bounty, and only the posting account can
decide on a submission. A role can be changed until the account has any
bounties or submissions, after which it is fixed.

Pull requests are looked up with the worker's own token, so a submission is
rejected unless the PR exists on the bounty's repo and is visible to them.

Sessions are httpOnly cookies backed by a `sessions` table. OAuth uses a
state cookie, and post-login redirects are restricted to same-origin paths.
The server refuses to start without `GITHUB_CLIENT_ID` and
`GITHUB_CLIENT_SECRET`.

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
6. Create a GitHub OAuth App under Settings, Developer settings, OAuth Apps.
   Homepage `http://localhost:5173`, callback
   `http://localhost:5173/api/auth/github/callback`. Put the client id and
   secret in `.env`. The app requests `read:user` and `public_repo`, so only
   public repositories and their pull requests are listed.
7. `pnpm dev` and open http://localhost:5173.

### Production

`pnpm build` compiles the web app, and `pnpm start` runs the API with
`NODE_ENV=production`, which also serves `apps/web/dist` from the same process
and origin. Set `APP_URL` to the public https URL so cookies are marked secure
and the OAuth callback resolves. The Lightning side stays regtest-only in this
build; mainnet is a deliberate non-goal.

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

## Out of scope

Reputation, disputes, multiple competing submissions, Lightning Address
payout, mainnet, mobile.
