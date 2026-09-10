import type { BountyStatus, PublicBounty } from "@boltbounty/shared";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, subscribe } from "../api";
import { StatusPill } from "../components/StatusPill";
import { sats, timeLeft } from "../format";

const TABS: { label: string; statuses: BountyStatus[] | null }[] = [
  { label: "Open", statuses: ["funded"] },
  { label: "Submitted", statuses: ["submitted"] },
  { label: "Paid", statuses: ["paid"] },
  { label: "All", statuses: null },
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

  const filter = TABS[tab]!.statuses;
  const shown = bounties?.filter((b) => !filter || filter.includes(b.status)) ?? [];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Bounties</h1>
        <Link to="/new" className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white">Post a bounty</Link>
      </div>
      <div className="mb-4 flex gap-1">
        {TABS.map((t, i) => (
          <button
            key={t.label}
            onClick={() => setTab(i)}
            className={`rounded px-3 py-1 text-sm ${i === tab ? "bg-gray-200 font-medium" : "text-gray-600 hover:bg-gray-100"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {bounties && shown.length === 0 && <p className="text-sm text-gray-500">Nothing here yet.</p>}
      <ul className="space-y-2">
        {shown.map((b) => (
          <li key={b.id}>
            <Link to={`/b/${b.id}`} className="block rounded-lg border bg-white p-4 hover:border-gray-400">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium">{b.title}</div>
                  <div className="mt-1 text-xs text-gray-500">{timeLeft(b.expiresAt, b.status)}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm">{sats(b.amountSats)}</div>
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
