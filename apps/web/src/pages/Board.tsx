import type { BountyStatus, PublicBounty } from "@boltbounty/shared";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, subscribe } from "../api";
import { StatusPill } from "../components/StatusPill";
import { Button, EmptyState, ErrorBox } from "../components/ui";
import { sats, timeLeft } from "../format";

const TABS: { label: string; statuses: BountyStatus[] | null; empty: string }[] = [
  { label: "Open", statuses: ["funded"], empty: "No funded bounties are waiting for a worker right now." },
  { label: "Submitted", statuses: ["submitted"], empty: "No submissions are waiting on a poster's decision." },
  { label: "Paid", statuses: ["paid"], empty: "Nothing has been paid out yet." },
  { label: "All", statuses: null, empty: "Post the first bounty to see it here." },
];

export function Board() {
  const [bounties, setBounties] = useState<PublicBounty[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    api.list().then(setBounties).catch((e: Error) => setError(e.message));
    // Any status change anywhere on the board arrives here; swap the row in place.
    return subscribe("/events", (change) =>
      setBounties((list) => list?.map((b) => (b.id === change.bountyId ? change.bounty : b)) ?? null),
    );
  }, []);

  const count = (statuses: BountyStatus[] | null) => bounties?.filter((b) => !statuses || statuses.includes(b.status)).length ?? 0;
  const current = TABS[tab]!;
  const shown = bounties?.filter((b) => !current.statuses || current.statuses.includes(b.status)) ?? [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Bounties</h1>
        <p className="mt-1 text-sm text-stone-600">Post a task, lock the sats on Lightning, pay the moment you approve the work.</p>
      </div>

      <div className="mb-4 inline-flex rounded-lg border border-stone-200 bg-white p-1">
        {TABS.map((t, i) => (
          <button
            key={t.label}
            onClick={() => setTab(i)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${i === tab ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100"}`}
          >
            {t.label}
            <span className={`ml-1.5 text-xs ${i === tab ? "text-stone-300" : "text-stone-400"}`}>{count(t.statuses)}</span>
          </button>
        ))}
      </div>

      <ErrorBox message={error} />
      {bounties === null && !error && <p className="text-sm text-stone-500">Loading…</p>}

      {bounties && shown.length === 0 && (
        <EmptyState
          icon="⚡"
          title="Nothing here yet"
          text={current.empty}
          action={<Link to="/new"><Button>Post a bounty</Button></Link>}
        />
      )}

      <ul className="space-y-3">
        {shown.map((b) => (
          <li key={b.id}>
            <Link to={`/b/${b.id}`} className="block rounded-xl border border-stone-200 bg-white p-5 transition hover:border-stone-300 hover:shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{b.title}</div>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-stone-500">
                    {timeLeft(b.expiresAt, b.status) && <span>{timeLeft(b.expiresAt, b.status)}</span>}
                    {b.repoUrl && <span>{new URL(b.repoUrl).hostname}</span>}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-lg font-semibold tabular-nums">{b.amountSats.toLocaleString()} <span className="text-xs font-normal text-stone-500">sats</span></div>
                  <div className="mt-1"><StatusPill status={b.status} /></div>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
