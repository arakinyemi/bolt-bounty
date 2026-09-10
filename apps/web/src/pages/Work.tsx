import type { MySubmission } from "@boltbounty/shared";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { StatusPill } from "../components/StatusPill";
import { Button, EmptyState, ErrorBox, Tag } from "../components/ui";
import { ago } from "../format";

// The signed-in worker's submissions, newest first.
export function Work() {
  const [items, setItems] = useState<MySubmission[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.mySubmissions().then(setItems).catch((e: Error) => setError(e.message));
  }, []);

  const earned = (items ?? []).filter((s) => s.bountyStatus === "paid" && s.decision === "approved").reduce((n, s) => n + s.bountyAmountSats, 0);

  return (
    <div className="space-y-8">
      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-end">
        <div>
          <Tag tone="blue">Worker</Tag>
          <h1 className="display mt-3 text-5xl sm:text-6xl">My work<span className="text-brand">.</span></h1>
          <p className="mt-4 max-w-lg text-muted">Every bounty you have claimed, and what happened to it.</p>
        </div>
        <dl className="grid grid-cols-2 divide-x-2 divide-ink border-2 border-ink bg-white shadow-hard">
          <div className="px-4 py-4"><dd className="font-display text-3xl font-bold text-blue">{items?.length ?? 0}</dd><dt className="label mt-1 text-muted">Claims</dt></div>
          <div className="px-4 py-4"><dd className="font-display text-3xl font-bold text-green">{earned.toLocaleString()}</dd><dt className="label mt-1 text-muted">Sats earned</dt></div>
        </dl>
      </div>

      <ErrorBox message={error} />
      {items && items.length === 0 && (
        <EmptyState icon="🛠️" title="No claims yet" text="Find a funded bounty on the board and submit one of your pull requests." action={<Link to="/"><Button>Find work</Button></Link>} />
      )}
      <ul className="space-y-3">
        {items?.map((s) => (
          <li key={s.id}>
            <Link to={`/b/${s.bountyId}`} className="card block bg-white p-5 transition hover:-translate-y-0.5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display text-lg font-bold">{s.bountyTitle}</h3>
                  <p className="mt-1 truncate text-sm text-muted">{s.prNumber ? `#${s.prNumber} ${s.prTitle ?? ""}` : s.workUrl}</p>
                  <p className="label mt-2 text-muted">Submitted {ago(s.createdAt)}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="font-display text-xl font-bold tabular-nums">{s.bountyAmountSats.toLocaleString()} <span className="label text-muted">sats</span></span>
                  <div className="flex gap-2">
                    <Tag tone={s.decision === "approved" ? "green" : s.decision === "rejected" ? "pink" : "yellow"}>{s.decision ?? "awaiting decision"}</Tag>
                    <StatusPill status={s.bountyStatus} />
                  </div>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
