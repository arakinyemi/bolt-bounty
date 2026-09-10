import type { GithubIssue } from "@boltbounty/shared";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { ago } from "../format";
import { Input, Spinner, Tag } from "./ui";

// Open issues on the chosen repo. Picking one ties the bounty to it and
// prefills the title and brief.
export function IssuePicker({ repoFullName, value, onChange }: { repoFullName: string; value: GithubIssue | null; onChange: (i: GithubIssue | null) => void }) {
  const [issues, setIssues] = useState<GithubIssue[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setIssues(null);
    api.issues(repoFullName).then(setIssues).catch((e: Error) => setError(e.message));
  }, [repoFullName]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (issues ?? []).filter((i) => !q || i.title.toLowerCase().includes(q) || String(i.number).includes(q)).slice(0, 8);
  }, [issues, query]);

  if (value) {
    return (
      <div className="mt-1.5 flex flex-wrap items-center gap-2 border-2 border-ink bg-white px-3 py-2">
        <Tag tone="green">#{value.number}</Tag>
        <span className="min-w-0 flex-1 truncate text-sm">{value.title}</span>
        <a href={value.url} target="_blank" rel="noreferrer" className="label text-muted underline">Open ↗</a>
        <button type="button" onClick={() => onChange(null)} className="label text-muted hover:text-brand">Change</button>
      </div>
    );
  }

  return (
    <div>
      <Input id="issue" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search open issues by title or number…" autoComplete="off" />
      <div className="mt-2 max-h-64 overflow-y-auto border-2 border-ink bg-white">
        {error && <p className="px-3 py-2 text-sm text-brand">{error}</p>}
        {!issues && !error && <p className="flex items-center gap-2 px-3 py-2 text-sm text-muted"><Spinner /> Loading issues…</p>}
        {issues && issues.length === 0 && <p className="px-3 py-2 text-sm text-muted">No open issues on this repo. You can still post without one.</p>}
        {issues && issues.length > 0 && shown.length === 0 && <p className="px-3 py-2 text-sm text-muted">No issues match.</p>}
        {shown.map((i) => (
          <button
            key={i.number}
            type="button"
            onClick={() => onChange(i)}
            className="flex w-full items-start gap-3 border-b border-ink/15 px-3 py-2.5 text-left last:border-b-0 hover:bg-paper"
          >
            <span className="font-mono text-sm text-muted">#{i.number}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{i.title}</span>
              <span className="label mt-1 flex flex-wrap items-center gap-2 text-muted">
                <span>by {i.author}</span>
                <span>{ago(i.updatedAt)}</span>
                {i.labels.slice(0, 3).map((l) => <Tag key={l}>{l}</Tag>)}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
