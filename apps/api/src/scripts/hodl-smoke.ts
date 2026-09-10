import readline from "node:readline/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { config } from "../config.js";
import { lnd } from "../lnd/client.js";
import { newPreimage } from "../lnd/preimage.js";
import { lndGet } from "../lnd/rest.js";

// pnpm lnd:hodl-smoke — proves the escrow mechanic end to end on the real
// node: create a hold invoice, wait for the poster to pay it, then settle or
// cancel. Run it twice, once each way, before trusting anything in Phase 3.

async function platformLocalSats(): Promise<number> {
  const r = await lndGet<{ local_balance: { sat: string } }>("/v1/balance/channels");
  return Number(r.local_balance.sat);
}

const { preimage, hash } = newPreimage();
const before = await platformLocalSats();
const bolt11 = await lnd.addHoldInvoice({
  hash,
  valueSats: 1000,
  memo: "boltbounty hodl smoke",
  expirySeconds: 600,
  cltvExpiry: config.holdInvoiceCltvExpiry,
});

console.log(`
hash:     ${hash}
preimage: ${preimage}
platform channel balance before: ${before} sats

Pay this 1,000-sat invoice from the poster node in Polar:

${bolt11}
`);

let state = (await lnd.lookupInvoice(hash)).state;
while (state === "OPEN") {
  await sleep(2000);
  state = (await lnd.lookupInvoice(hash)).state;
  console.log(`state: ${state}`);
}
if (state !== "ACCEPTED") {
  console.error(`invoice reached ${state} without being paid`);
  process.exit(1);
}

console.log(`
ACCEPTED: the poster's HTLC is locked in flight.
platform channel balance now: ${await platformLocalSats()} sats (unchanged: nothing has been received)
`);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const answer = (await rl.question("Settle the invoice? y = settle (reveal preimage), n = cancel: ")).trim().toLowerCase();
rl.close();

if (answer === "y") await lnd.settleInvoice(preimage);
else await lnd.cancelInvoice(hash);

const final = await lnd.lookupInvoice(hash);

// LND resolves the HTLC a moment after settle; give the balance time to move.
let after = await platformLocalSats();
for (let i = 0; i < 5 && final.state === "SETTLED" && after === before; i++) {
  await sleep(1000);
  after = await platformLocalSats();
}
console.log(`
final state: ${final.state}
platform channel balance after: ${after} sats (before: ${before})
`);
