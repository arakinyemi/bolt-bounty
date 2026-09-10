# BoltBounty

Lightning-escrowed micro-bounty board. Hackathon MVP, regtest only.

## Architecture
- apps/api: Fastify + TypeScript, routes under /api. Talks to the PLATFORM LND
  node over REST. Owns the SQLite database (data/boltbounty.db). All Lightning
  logic lives in apps/api/src/lnd/. GitHub OAuth and API calls live in
  apps/api/src/github/; cookie sessions in apps/api/src/auth.ts. Without
  GitHub credentials the app runs in guest mode (poster secret auth).
- apps/web: React + Vite. Talks only to apps/api. Never talks to LND directly.
- packages/shared: TypeScript types for Bounty, Submission, and API payloads.

## Lightning mechanics (do not change without asking)
- Funding uses a HODL invoice created on the platform node (invoicesrpc
  AddHoldInvoice). The API generates a 32-byte preimage, stores it, and
  passes sha256(preimage) as the hash.
- Invoice state ACCEPTED means the poster's HTLC is locked in-flight. This is
  the "funded" state. Do not treat ACCEPTED as received money.
- Approve = SettleInvoice(preimage) then pay the worker's BOLT11 invoice with
  router SendPaymentV2. Cancel/expire = CancelInvoice(hash).
- Never mine more than a few regtest blocks during a demo; an HTLC held past
  its CLTV expiry is force-cancelled by LND.

## Conventions
- All sats amounts are integers named *_sats. No floats.
- Bounty status is a string enum in packages/shared; the state machine in
  apps/api/src/bounties/state.ts is the only place transitions happen.
- Environment variables are documented in .env.example. Never commit macaroons.
- Log every LND call with method, hash prefix (first 8 chars), and outcome.

## Commands
- pnpm install
- pnpm dev            (runs api on :3000 and web on :5173)
- pnpm test           (vitest, api only)
- pnpm lnd:check      (verifies connectivity to the platform node)
- pnpm lnd:hodl-smoke (interactive hold invoice settle/cancel test)
- pnpm demo:reset     (cancels open hold invoices, deletes the database)
- pnpm build          (builds apps/web)
- pnpm start          (api in production mode, serving apps/web/dist)

## Testing against Polar
See docs/polar.md for node names, ports, and the funding script.
