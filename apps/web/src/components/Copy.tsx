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
      className={`label border border-ink px-2 py-1 font-semibold transition ${done ? "bg-green-soft" : "bg-white hover:bg-paper"}`}
    >
      {done ? "Copied" : label}
    </button>
  );
}

// A payment hash, truncated so it can be cross-referenced in Polar.
export function Hash({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="label w-32 text-muted">{label}</span>
      <code className="border border-ink bg-white px-1.5 py-0.5 font-mono text-xs" title={value}>
        {value.slice(0, 10)}…{value.slice(-6)}
      </code>
      <CopyButton value={value} />
    </div>
  );
}
