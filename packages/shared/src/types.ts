export type BountyStatus =
  | "unfunded"    // HODL invoice created, not yet paid
  | "funded"      // HTLC accepted, sats locked
  | "submitted"   // worker submitted, awaiting poster decision
  | "paid"        // hold invoice settled and worker paid
  | "cancelled"   // poster cancelled or rejected, hold invoice cancelled
  | "expired";    // expiry reached with no approval, hold invoice cancelled

export const BOUNTY_STATUSES: readonly BountyStatus[] = [
  "unfunded", "funded", "submitted", "paid", "cancelled", "expired",
];

export interface Bounty {
  id: string;
  title: string;
  description: string;
  repoUrl: string | null;
  amountSats: number;
  status: BountyStatus;
  paymentHash: string;
  holdInvoice: string;
  posterSecret: string;        // returned once at creation; acts as poster auth
  fundedAt: string | null;
  expiresAt: string;
  createdAt: string;
  payoutPaymentHash: string | null;
}

export interface Submission {
  id: string;
  bountyId: string;
  workerName: string;
  workUrl: string;
  notes: string;
  payoutInvoice: string;       // BOLT11 from the worker for amountSats
  createdAt: string;
  decidedAt: string | null;
  decision: "approved" | "rejected" | null;
  payoutError: string | null;  // set when the hold invoice settled but paying the worker failed
}

// What the API returns. The poster secret is only ever returned at creation.
export type PublicBounty = Omit<Bounty, "posterSecret">;
export type BountyDetail = PublicBounty & { submissions: Submission[] };

// Server-sent event emitted on every status transition.
export interface StatusChange {
  bountyId: string;
  from: BountyStatus;
  to: BountyStatus;
  event: string;
  at: string;
  bounty: PublicBounty;
}
