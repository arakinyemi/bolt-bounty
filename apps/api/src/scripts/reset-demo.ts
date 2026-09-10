import fs from "node:fs";
import { config } from "../config.js";
import { lnd } from "../lnd/client.js";
import { lndGet } from "../lnd/rest.js";

// pnpm demo:reset — cancels every pending BoltBounty hold invoice on the
// platform node (so no poster payment is left in flight) and deletes the
// database. Run it before each demo rehearsal.

interface PendingInvoice {
  memo: string;
  r_hash: string; // base64
  state: "OPEN" | "ACCEPTED" | "SETTLED" | "CANCELED";
  value: string;
}

const { invoices } = await lndGet<{ invoices: PendingInvoice[] }>("/v1/invoices?pending_only=true");
const ours = invoices.filter((i) => i.memo.toLowerCase().startsWith("boltbounty"));

for (const inv of ours) {
  const hash = Buffer.from(inv.r_hash, "base64").toString("hex");
  await lnd.cancelInvoice(hash);
  console.log(`cancelled ${inv.state} invoice ${hash.slice(0, 8)}… (${inv.value} sats, "${inv.memo}")`);
}
console.log(`${ours.length} hold invoice(s) cancelled`);

for (const suffix of ["", "-wal", "-shm"]) {
  const file = config.databasePath + suffix;
  if (fs.existsSync(file)) {
    fs.rmSync(file);
    console.log(`deleted ${file}`);
  }
}
console.log("reset complete");
