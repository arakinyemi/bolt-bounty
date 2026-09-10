import type { BountyStatus } from "@boltbounty/shared";

// Where the bounty is in its life. Terminal failures replace the last step.
const STEPS: { key: string; label: string; reached: BountyStatus[] }[] = [
  { key: "created", label: "Created", reached: ["unfunded", "funded", "submitted", "paid", "cancelled", "expired"] },
  { key: "funded", label: "Sats locked", reached: ["funded", "submitted", "paid", "cancelled"] },
  { key: "submitted", label: "Work in", reached: ["submitted", "paid"] },
  { key: "paid", label: "Paid out", reached: ["paid"] },
];

export function Progress({ status }: { status: BountyStatus }) {
  const failed = status === "cancelled" || status === "expired";
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((step, i) => {
        const last = i === STEPS.length - 1;
        const done = step.reached.includes(status) || (last && failed);
        const label = last && failed ? (status === "cancelled" ? "Cancelled" : "Expired") : step.label;
        const box = last && failed ? "bg-brand text-white" : done ? "bg-ink text-white" : "bg-white text-muted";
        return (
          <li key={step.key} className="flex items-center gap-2">
            <span className={`label flex h-6 w-6 items-center justify-center border-2 border-ink font-semibold ${box}`}>{done ? "✓" : i + 1}</span>
            <span className={`label hidden whitespace-nowrap sm:inline ${done ? "font-semibold" : "text-muted"}`}>{label}</span>
            {!last && <span className="mx-1 h-0.5 w-5 bg-ink/30" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
