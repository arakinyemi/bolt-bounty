import type { BountyStatus, PublicBounty } from "@boltbounty/shared";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, subscribe } from "../api";
import { StatusPill } from "../components/StatusPill";
import { Avatar, Button, EmptyState, ErrorBox, Tag } from "../components/ui";
import { timeLeft } from "../format";

const TABS: { label: string; statuses: BountyStatus[] | null; empty: string }[] = [
  { label: "Open", statuses: ["funded"], empty: "No funded bounties are waiting for a worker right now." },
  { label: "In review", statuses: ["submitted"], empty: "No submissions are waiting on a poster's decision." },
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

  const all = bounties ?? [];
  const count = (statuses: BountyStatus[] | null) => all.filter((b) => !statuses || statuses.includes(b.status)).length;
  const sum = (statuses: BountyStatus[]) => all.filter((b) => statuses.includes(b.status)).reduce((n, b) => n + b.amountSats, 0);
  const current = TABS[tab]!;
  const shown = all.filter((b) => !current.statuses || current.statuses.includes(b.status));

  return (
    <div className="space-y-8">
      <section className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-end">
        <div>
          <div className="mb-4 flex flex-wrap gap-2">
            <Tag tone="yellow">Lightning escrow</Tag>
            <Tag tone="blue">Hold invoices</Tag>
            <Tag tone="pink">Regtest</Tag>
          </div>
          <h1 className="display text-5xl sm:text-7xl">
            Open<br />bounties<span className="text-brand">.</span>
          </h1>
          <p className="mt-5 max-w-lg text-base text-muted">
            Post a task, lock the sats on Lightning, pay the moment you approve the pull request. Nobody holds the money in between.
          </p>
        </div>
        <dl className="grid grid-cols-3 divide-x-2 divide-ink border-2 border-ink bg-white shadow-hard">
          <Stat value={count(["funded"])} label="Open" tone="text-blue" />
          <Stat value={sum(["funded", "submitted"])} label="Sats locked" tone="text-yellow" />
          <Stat value={sum(["paid"])} label="Sats paid" tone="text-green" />
        </dl>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-ink pt-6">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t, i) => (
            <button
              key={t.label}
              onClick={() => setTab(i)}
              className={`label border-2 border-ink px-3 py-2 font-semibold transition ${i === tab ? "bg-ink text-white shadow-hard-sm" : "bg-white hover:bg-paper"}`}
            >
              {t.label} <span className={i === tab ? "text-white/60" : "text-muted"}>{count(t.statuses)}</span>
            </button>
          ))}
        </div>
        <Link to="/new"><Button>Post a bounty</Button></Link>
      </div>

      <ErrorBox message={error} />
      {bounties === null && !error && <p className="text-sm text-muted">Loading…</p>}

      {bounties && shown.length === 0 && (
        <EmptyState icon="⚡" title="Nothing here yet" text={current.empty} action={<Link to="/new"><Button>Post a bounty</Button></Link>} />
      )}

      <ul className="grid gap-5 md:grid-cols-2">
        {shown.map((b) => (
          <li key={b.id}>
            <Link to={`/b/${b.id}`} className="card block h-full bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_#1e1e1e]">
              <div className="flex items-start justify-between gap-3">
                {b.repoFullName ? <Tag>{b.repoFullName}</Tag> : b.repoUrl ? <Tag>{new URL(b.repoUrl).hostname}</Tag> : <Tag>No repo</Tag>}
                <StatusPill status={b.status} />
              </div>
              <h3 className="mt-4 font-display text-xl font-bold leading-tight">{b.title}</h3>
              <p className="mt-2 line-clamp-2 text-sm text-muted">{b.description}</p>
              <div className="mt-5 flex items-end justify-between gap-3 border-t border-ink/15 pt-4">
                <div className="label flex items-center gap-2 text-muted">
                  {b.poster ? <><Avatar src={b.poster.avatarUrl} alt={b.poster.login} size={20} /> {b.poster.login}</> : "Guest poster"}
                  {timeLeft(b.expiresAt, b.status) && <span>· {timeLeft(b.expiresAt, b.status)}</span>}
                </div>
                <div className="text-right">
                  <span className="font-display text-2xl font-bold tabular-nums">{b.amountSats.toLocaleString()}</span>
                  <span className="label ml-1 text-muted">sats</span>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <div className="px-4 py-4">
      <dd className={`font-display text-3xl font-bold tabular-nums ${tone}`}>{value.toLocaleString()}</dd>
      <dt className="label mt-1 text-muted">{label}</dt>
    </div>
  );
}
