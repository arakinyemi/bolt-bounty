import type { BountyStatus } from "@boltbounty/shared";

const STYLES: Record<BountyStatus, string> = {
  unfunded: "bg-gray-100 text-gray-700",
  funded: "bg-amber-100 text-amber-800",
  submitted: "bg-blue-100 text-blue-800",
  paid: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  expired: "bg-red-100 text-red-800",
};

const LABELS: Record<BountyStatus, string> = {
  unfunded: "Unfunded",
  funded: "Funded · escrowed",
  submitted: "Submitted",
  paid: "Paid",
  cancelled: "Cancelled",
  expired: "Expired",
};

export function StatusPill({ status }: { status: BountyStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      {status === "funded" && <span aria-hidden>🔒</span>}
      {LABELS[status]}
    </span>
  );
}
