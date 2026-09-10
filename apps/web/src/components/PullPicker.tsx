import type { GithubPull } from "@boltbounty/shared";
import { useEffect, useState } from "react";
import { api } from "../api";
import { Spinner, Tag } from "./ui";
import { ago } from "../format";

// Open pull requests on the bounty's repo; the worker's own come first.
export function PullPicker({ repoFullName, value, onChange }: { repoFullName: string; value: number | null; onChange: (n: number | null) => void }) {
  const [pulls, setPulls] = useState<GithubPull[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.pulls(repoFullName)
      .then((list) => setPulls([...list].sort((a, b) => Number(b.mine) - Number(a.mine))))
      .catch((e: Error) => setError(e.message));
  }, [repoFullName]);

  return (
    <div className="mt-1.5 max-h-72 overflow-y-auto border-2 border-ink bg-white">
      {error && <p className="px-3 py-2 text-sm text-brand">{error}</p>}
      {!pulls && !error && <p className="flex items-center gap-2 px-3 py-2 text-sm text-muted"><Spinner /> Loading pull requests…</p>}
      {pulls && pulls.length === 0 && (
        <p className="px-3 py-3 text-sm text-muted">
          No open pull requests on <span className="font-mono">{repoFullName}</span>. Open one on GitHub, then come back.
        </p>
      )}
      {pulls?.map((p) => {
        const selected = value === p.number;
        return (
          <button
            key={p.number}
            type="button"
            onClick={() => onChange(selected ? null : p.number)}
            className={`flex w-full items-start gap-3 border-b border-ink/15 px-3 py-2.5 text-left last:border-b-0 ${selected ? "bg-blue-soft" : "hover:bg-paper"}`}
          >
            <span className={`label mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border-2 border-ink ${selected ? "bg-ink text-white" : "bg-white"}`}>{selected ? "✓" : ""}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium"><span className="font-mono text-muted">#{p.number}</span> {p.title}</span>
              <span className="label mt-1 flex flex-wrap items-center gap-2 text-muted">
                <span>by {p.author}</span>
                <span>{ago(p.updatedAt)}</span>
                {p.mine && <Tag tone="green">yours</Tag>}
                {p.draft && <Tag tone="yellow">draft</Tag>}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
