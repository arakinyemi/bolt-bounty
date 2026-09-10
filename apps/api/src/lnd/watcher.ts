import type { Ctx } from "../bounties/service.js";
import { apply } from "../bounties/service.js";
import { bounties } from "../db/repo.js";
import { lnd } from "./client.js";

// Polls LND for every non-terminal bounty and reconciles our status with the
// hold invoice's state. Polling is deliberate for the MVP; SubscribeSingleInvoice
// is the next step.

export async function pollOnce(ctx: Ctx): Promise<void> {
  for (const b of bounties.watched(ctx.db)) {
    try {
      const { state } = await lnd.lookupInvoice(b.paymentHash);
      const pastExpiry = new Date(b.expiresAt).getTime() < Date.now();

      if (state === "CANCELED") {
        // Covers LND force-cancelling near CLTV expiry and OPEN invoices that
        // LND expired on its own.
        apply(ctx, b, "expired");
      } else if (state === "ACCEPTED" && b.status === "unfunded") {
        apply(ctx, b, "htlc_accepted", { fundedAt: new Date().toISOString() });
      } else if (pastExpiry && (state === "OPEN" || state === "ACCEPTED")) {
        await lnd.cancelInvoice(b.paymentHash);
        apply(ctx, b, "expired");
      }
      // SETTLED while still "submitted" means an approve is mid-flight or its
      // payout failed; the service owns that path, so leave it alone.
    } catch (err) {
      console.error(`[watcher] bounty ${b.id}: ${err instanceof Error ? err.message : err}`);
    }
  }
}

export function startWatcher(ctx: Ctx, intervalMs = 3000): () => void {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await pollOnce(ctx);
    } finally {
      running = false;
    }
  }, intervalMs);
  return () => clearInterval(timer);
}
