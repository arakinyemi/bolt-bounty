# Demo run sheet

Rehearse this twice. Total time about four minutes.

## Before the demo

1. Polar: network **Bolt Bounty** started, three nodes green, two channels
   (poster to platform, platform to worker). **Auto Mine off.**
2. `pnpm lnd:check` prints OK with 2 active channels.
3. `pnpm demo:reset` to cancel any stale hold invoices and clear the board.
4. `pnpm dev`, then open http://localhost:5173 in one browser window and Polar
   in another, side by side.
5. You need two GitHub accounts: one signed in as a poster in a normal
   window, one signed in as a worker in a private window. A poster cannot
   claim their own bounty. The worker account needs an open pull request on
   one of the poster's public repositories.
6. In Polar, click **poster** and note its channel balance. Click **worker**
   and note its balance.

Do not mine blocks during the demo. A held HTLC is force-cancelled by LND when
the chain reaches its CLTV expiry.

## Sequence

### 1. The network (20 seconds)
Show Polar. "Three LND nodes on regtest. Poster, our platform, worker. Two
channels. The poster's balance is X sats."

### 2. Create a bounty (30 seconds)
As the poster: **Post a bounty**. Pick the repository, then the open issue.
The title and brief fill in from it. Amount 20000. Create. (Or start from
GitHub: paste the issue URL into `/new?issue=`.) "The API generated a preimage, kept it, and asked our node for a hold
invoice locked to its hash. Here is the invoice and the poster secret."

### 3. Fund it (45 seconds)
Copy the invoice. In Polar, click **poster**, Actions, **Pay Invoice**, paste,
pay. Watch the browser flip to **Funded and escrowed** on its own.

Show the GitHub issue: BoltBounty has commented with the amount and a claim
link. Show Polar: poster's payment is pending, platform's balance has not
changed.
Say: "The sats are locked in flight on the poster's channel. Nobody can spend
them, including us. There is no contract and no custodian, just an HTLC that
our node has accepted but cannot settle without the preimage."

### 4. Submit work (30 seconds)
In Polar, click **worker**, Actions, **Create Invoice**, 20000 sats, copy it.
In the worker's window open the bounty, pick the open pull request, paste
the invoice, submit. Status turns **Submitted**. "Escrow is still locked."

### 5. Approve (30 seconds)
Back in the poster's window, click **Approve and pay**. Status turns **Paid**, and the page shows both the
hold invoice hash and the payout hash.

Show Polar: poster's payment is now complete, worker's balance is up 20,000.
Say: "Approval revealed the preimage to our node. That settled the poster's
payment and our node paid the worker in the same second."

### 6. Refund without a refund (45 seconds)
Post a second bounty, 5000 sats. Pay it from poster in Polar. Wait for the
flip to Funded. Click **Cancel bounty and release escrow**.

Show Polar: poster's payment shows failed, balance restored to X. Say:
"We cancelled the hold invoice. The poster's payment simply failed back
along the route. No refund transaction, no fee, nothing on chain."

### 7. How it works (30 seconds)
Open **How it works**. Walk the three steps. Close on the next step: the worker
generates the preimage, so approval settles both legs atomically and the
platform never holds funds.

## If something goes wrong

- Browser does not flip to Funded within five seconds: check the api terminal
  for `[watcher]` errors, then reload the page.
- Approve fails with "payout failed": the escrow has settled to the platform
  node. Click **Retry payout** on the bounty. Usually the worker invoice
  expired; create a fresh one and submit again if retry keeps failing.
- Payment from poster fails immediately: the channel is out of outbound
  liquidity or the invoice expired. `pnpm demo:reset` and start over.
