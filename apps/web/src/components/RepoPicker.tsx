import type { GithubRepo } from "@boltbounty/shared";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { Input, Spinner, Tag } from "./ui";

// Searchable list of the signed-in poster's GitHub repositories.
export function RepoPicker({ value, onChange }: { value: GithubRepo | null; onChange: (r: GithubRepo | null) => void }) {
  const [repos, setRepos] = useState<GithubRepo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    api.repos().then(setRepos).catch((e: Error) => setError(e.message));
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (repos ?? []).filter((r) => !q || r.fullName.toLowerCase().includes(q)).slice(0, 8);
  }, [repos, query]);

  if (value) {
    return (
      <div className="mt-1.5 flex flex-wrap items-center gap-2 border-2 border-ink bg-white px-3 py-2">
        <Tag tone="blue">{value.private ? "private" : "public"}</Tag>
        <span className="font-mono text-sm">{value.fullName}</span>
        <button type="button" onClick={() => onChange(null)} className="label ml-auto text-muted hover:text-brand">Change</button>
      </div>
    );
  }

  return (
    <div>
      <Input id="repo" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your repositories…" autoComplete="off" />
      <div className="mt-2 max-h-64 overflow-y-auto border-2 border-ink bg-white">
        {error && <p className="px-3 py-2 text-sm text-brand">{error}</p>}
        {!repos && !error && <p className="flex items-center gap-2 px-3 py-2 text-sm text-muted"><Spinner /> Loading repositories…</p>}
        {repos && shown.length === 0 && <p className="px-3 py-2 text-sm text-muted">No repositories match.</p>}
        {shown.map((r) => (
          <button
            key={r.fullName}
            type="button"
            onClick={() => onChange(r)}
            className="flex w-full items-start justify-between gap-3 border-b border-ink/15 px-3 py-2 text-left last:border-b-0 hover:bg-paper"
          >
            <span className="min-w-0">
              <span className="block truncate font-mono text-sm">{r.fullName}</span>
              {r.description && <span className="block truncate text-xs text-muted">{r.description}</span>}
            </span>
            {r.private && <Tag tone="yellow">private</Tag>}
          </button>
        ))}
      </div>
    </div>
  );
}
