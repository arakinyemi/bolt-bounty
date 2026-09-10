import { lnd } from "../lnd/client.js";
import { lndGet } from "../lnd/rest.js";

// pnpm lnd:check — proves the API can reach the platform node and that the
// regtest topology from docs/polar.md exists (poster->platform, platform->worker).

interface Channel {
  remote_pubkey: string;
  capacity: string;
  local_balance: string;
  remote_balance: string;
  active: boolean;
}

const info = await lnd.getInfo();
const { channels } = await lndGet<{ channels: Channel[] }>("/v1/channels");
const network = info.chains[0]?.network ?? "unknown";

console.log(`alias:           ${info.alias}`);
console.log(`pubkey:          ${info.identity_pubkey}`);
console.log(`version:         ${info.version}`);
console.log(`network:         ${network} (height ${info.block_height}, synced ${info.synced_to_chain})`);
console.log(`active channels: ${info.num_active_channels} (pending ${info.num_pending_channels})`);
for (const c of channels) {
  const state = c.active ? "active" : "inactive";
  console.log(`  peer ${c.remote_pubkey.slice(0, 16)}…  cap ${c.capacity}  local ${c.local_balance}  remote ${c.remote_balance}  ${state}`);
}

const problems: string[] = [];
if (network !== "regtest") problems.push(`node is on ${network}; this project is regtest only`);
if (!info.synced_to_chain) problems.push("node is not synced to chain");
if (info.num_active_channels < 2) problems.push("expected 2 active channels (poster->platform, platform->worker); see docs/polar.md");

if (problems.length > 0) {
  for (const p of problems) console.error(`FAIL: ${p}`);
  process.exit(1);
}
console.log("OK: platform node reachable on regtest with 2 active channels");
