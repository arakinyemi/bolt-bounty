import { config } from "../config.js";
import type { Db } from "../db/index.js";
import { users, type BountyRecord } from "../db/repo.js";
import { github } from "./api.js";

// Posts a comment on the bounty's GitHub issue so the money is visible where
// the work is discussed. Best-effort: a GitHub failure is logged, never
// surfaced, and never blocks a Lightning operation.

export async function commentOnIssue(db: Db, b: BountyRecord, body: string): Promise<void> {
  if (!b.repoFullName || !b.issueNumber) return;
  const poster = users.get(db, b.posterUserId);
  if (!poster) return;
  try {
    await github.comment(poster.accessToken, b.repoFullName, b.issueNumber, body);
    console.log(`[github] commented on ${b.repoFullName}#${b.issueNumber} for bounty ${b.id.slice(0, 8)}`);
  } catch (err) {
    console.error(`[github] could not comment on ${b.repoFullName}#${b.issueNumber}: ${err instanceof Error ? err.message : err}`);
  }
}

const bountyUrl = (b: BountyRecord) => `${config.appUrl}/b/${b.id}`;

export const issueMessages = {
  funded: (b: BountyRecord) =>
    `🔒 **${b.amountSats.toLocaleString()} sats** are escrowed on Lightning for this issue via BoltBounty.\n\n` +
    `The sats are locked in a hold invoice: nobody can spend them until a pull request is approved. ` +
    `Open a PR that references #${b.issueNumber} and claim it here: ${bountyUrl(b)}`,
  paid: (b: BountyRecord, workerLogin: string, prNumber: number | null) =>
    `⚡ Paid **${b.amountSats.toLocaleString()} sats** to @${workerLogin}` +
    (prNumber ? ` for #${prNumber}` : "") +
    ` via BoltBounty. Escrow released and settled over Lightning. ${bountyUrl(b)}`,
  cancelled: (b: BountyRecord) =>
    `The ${b.amountSats.toLocaleString()} sat bounty on this issue was cancelled and the escrow returned to the poster. ${bountyUrl(b)}`,
};
