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
      className={`rounded-md border px-2 py-0.5 text-xs font-medium transition ${done ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-stone-300 bg-white text-stone-700 hover:bg-stone-100"}`}
    >
      {done ? "Copied ✓" : label}
    </button>
  );
}

// A payment hash, truncated so it can be cross-referenced in Polar.
export function Hash({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span className="w-32 text-stone-500">{label}</span>
      <code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-xs text-stone-800" title={value}>
        {value.slice(0, 10)}…{value.slice(-6)}
      </code>
      <CopyButton value={value} />
    </div>
  );
}
