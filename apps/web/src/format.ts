import type { BountyStatus } from "@boltbounty/shared";

export const sats = (n: number) => `${n.toLocaleString()} sats`;

const TERMINAL: BountyStatus[] = ["paid", "cancelled", "expired"];

// Countdown to expiry, or nothing once the bounty has reached a final state.
export function timeLeft(expiresAt: string, status: BountyStatus): string {
  if (TERMINAL.includes(status)) return "";
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 48) return `${Math.floor(h / 24)}d left`;
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

export function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
