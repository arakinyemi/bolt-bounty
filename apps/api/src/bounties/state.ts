import type { Bounty, BountyStatus } from "@boltbounty/shared";

// The only place a bounty's status may change. Routes and the invoice
// watcher call transition() and persist whatever it returns.

export type BountyEvent =
  | "htlc_accepted"
  | "submission_received"
  | "approved"
  | "rejected"
  | "expired"
  | "poster_cancelled";

const TRANSITIONS: Record<BountyStatus, Partial<Record<BountyEvent, BountyStatus>>> = {
  unfunded:  { htlc_accepted: "funded", expired: "expired" },
  funded:    { submission_received: "submitted", poster_cancelled: "cancelled", expired: "expired" },
  submitted: { approved: "paid", rejected: "funded", expired: "expired" },
  paid:      {},
  cancelled: {},
  expired:   {},
};

export class IllegalTransition extends Error {
  constructor(readonly bountyId: string, readonly from: BountyStatus, readonly event: BountyEvent) {
    super(`bounty ${bountyId}: cannot apply "${event}" while "${from}"`);
    this.name = "IllegalTransition";
  }
}

export function transition(bounty: Pick<Bounty, "id" | "status">, event: BountyEvent): BountyStatus {
  const next = TRANSITIONS[bounty.status][event];
  if (!next) throw new IllegalTransition(bounty.id, bounty.status, event);
  return next;
}
