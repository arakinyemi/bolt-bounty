import { useState } from "react";

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-100"
    >
      {done ? "Copied" : label}
    </button>
  );
}

// A payment hash or preimage, truncated so it can be cross-referenced in Polar.
export function Hash({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-gray-500">{label}</span>
      <code className="font-mono text-xs" title={value}>
        {value.slice(0, 12)}…{value.slice(-8)}
      </code>
      <CopyButton value={value} />
    </div>
  );
}
