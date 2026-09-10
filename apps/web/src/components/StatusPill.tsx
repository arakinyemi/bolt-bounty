import type { BountyStatus } from "@boltbounty/shared";
import { Tag, type Tone } from "./ui";

const STYLES: Record<BountyStatus, { tone: Tone; label: string }> = {
  unfunded: { tone: "white", label: "Awaiting funding" },
  funded: { tone: "yellow", label: "Escrowed" },
  submitted: { tone: "blue", label: "Work submitted" },
  paid: { tone: "green", label: "Paid" },
  cancelled: { tone: "pink", label: "Cancelled" },
  expired: { tone: "pink", label: "Expired" },
};

export function StatusPill({ status }: { status: BountyStatus }) {
  const s = STYLES[status];
  return <Tag tone={s.tone}>{status === "funded" && <span aria-hidden>🔒</span>}{s.label}</Tag>;
}
