import type { BountyStatus } from "@boltbounty/shared";

// Where the bounty is in its life. Terminal failures replace the last step.
const STEPS: { key: string; label: string; reached: BountyStatus[] }[] = [
  { key: "created", label: "Created", reached: ["unfunded", "funded", "submitted", "paid", "cancelled", "expired"] },
  { key: "funded", label: "Sats locked", reached: ["funded", "submitted", "paid", "cancelled"] },
  { key: "submitted", label: "Work submitted", reached: ["submitted", "paid"] },
  { key: "paid", label: "Paid out", reached: ["paid"] },
];

export function Progress({ status }: { status: BountyStatus }) {
  const failed = status === "cancelled" || status === "expired";
  return (
    <ol className="flex items-center gap-2 text-xs">
      {STEPS.map((step, i) => {
        const last = i === STEPS.length - 1;
        const done = step.reached.includes(status);
        const label = last && failed ? (status === "cancelled" ? "Cancelled" : "Expired") : step.label;
        const tone = last && failed ? "bg-rose-500 text-white" : done ? "bg-amber-500 text-white" : "bg-stone-200 text-stone-500";
        return (
          <li key={step.key} className="flex items-center gap-2">
            <span className={`flex h-5 w-5 items-center justify-center rounded-full font-semibold ${tone}`}>{done || (last && failed) ? "✓" : i + 1}</span>
            <span className={`hidden sm:inline ${done || (last && failed) ? "font-medium text-stone-800" : "text-stone-500"}`}>{label}</span>
            {!last && <span className="mx-1 h-px w-6 bg-stone-300" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
