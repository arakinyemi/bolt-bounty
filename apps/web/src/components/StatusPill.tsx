import type { BountyStatus } from "@boltbounty/shared";

const STYLES: Record<BountyStatus, { pill: string; dot: string; label: string }> = {
  unfunded: { pill: "bg-stone-100 text-stone-700", dot: "bg-stone-400", label: "Awaiting funding" },
  funded: { pill: "bg-amber-100 text-amber-900", dot: "bg-amber-500", label: "Funded · escrowed" },
  submitted: { pill: "bg-sky-100 text-sky-900", dot: "bg-sky-500", label: "Work submitted" },
  paid: { pill: "bg-emerald-100 text-emerald-900", dot: "bg-emerald-500", label: "Paid" },
  cancelled: { pill: "bg-rose-100 text-rose-900", dot: "bg-rose-500", label: "Cancelled" },
  expired: { pill: "bg-rose-100 text-rose-900", dot: "bg-rose-500", label: "Expired" },
};

export function StatusPill({ status }: { status: BountyStatus }) {
  const s = STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${s.pill}`}>
      {status === "funded" ? <span aria-hidden>🔒</span> : <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden />}
      {s.label}
    </span>
  );
}
