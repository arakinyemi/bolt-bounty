import type { BountyStatus, PublicBounty } from "@boltbounty/shared";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, signInUrl, subscribe } from "../api";
import { useAuth } from "../auth";
import { StatusPill } from "../components/StatusPill";
import { Avatar, Button, EmptyState, ErrorBox, Tag } from "../components/ui";
import { timeLeft } from "../format";

interface Tab { label: string; empty: string; match: (b: PublicBounty, meId: string | null) => boolean }

const STATUS_TABS: Tab[] = [
  { label: "Open", empty: "No funded bounties are waiting for a worker right now.", match: (b) => b.status === "funded" },
  { label: "In review", empty: "No submissions are waiting on a poster's decision.", match: (b) => b.status === "submitted" },
  { label: "Paid", empty: "Nothing has been paid out yet.", match: (b) => b.status === "paid" },
  { label: "All", empty: "Post the first bounty to see it here.", match: () => true },
];
const MINE_TAB: Tab = { label: "Mine", empty: "You have not posted a bounty yet.", match: (b, meId) => b.posterUserId === meId };

const HERO = {
  poster: { title: <>Fund the work<span className="text-brand">.</span></>, text: "Pick a repo, lock the sats, and pay the moment you approve the pull request. Nobody holds the money in between." },
  worker: { title: <>Get paid for PRs<span className="text-brand">.</span></>, text: "Every open bounty here is already funded and locked. Submit your pull request and the sats are yours on approval." },
  none: { title: <>Open bounties<span className="text-brand">.</span></>, text: "Post a task, lock the sats on Lightning, pay the moment you approve the pull request. Nobody holds the money in between." },
};

export function Board() {
  const { me, role } = useAuth();
  const [bounties, setBounties] = useState<PublicBounty[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState(0);
  const TABS = role === "poster" ? [...STATUS_TABS, MINE_TAB] : STATUS_TABS;
  const hero = HERO[role ?? "none"];

  useEffect(() => {
    api.list().then(setBounties).catch((e: Error) => setError(e.message));
    // Any status change anywhere on the board arrives here; swap the row in place.
    return subscribe("/events", (change) =>
      setBounties((list) => list?.map((b) => (b.id === change.bountyId ? change.bounty : b)) ?? null),
    );
  }, []);

  const all = bounties ?? [];
  const meId = me?.id ?? null;
  const count = (t: Tab) => all.filter((b) => t.match(b, meId)).length;
  const sum = (statuses: BountyStatus[]) => all.filter((b) => statuses.includes(b.status)).reduce((n, b) => n + b.amountSats, 0);
  const current = TABS[tab] ?? TABS[0]!;
  const shown = all.filter((b) => current.match(b, meId));
  const cta = role === "poster" ? <Link to="/new"><Button>Post a bounty</Button></Link>
    : role === "worker" ? null
    : me ? null
    : <a href={signInUrl("/")}><Button>Sign in with GitHub</Button></a>;

  return (
    <div className="space-y-8">
      <section className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-end">
        <div>
          <div className="mb-4 flex flex-wrap gap-2">
            <Tag tone="yellow">Lightning escrow</Tag>
            <Tag tone="blue">Hold invoices</Tag>
            <Tag tone="pink">Regtest</Tag>
          </div>
          <h1 className="display text-5xl sm:text-7xl">{hero.title}</h1>
          <p className="mt-5 max-w-lg text-base text-muted">{hero.text}</p>
        </div>
        <dl className="grid grid-cols-3 divide-x-2 divide-ink border-2 border-ink bg-white shadow-hard">
          <Stat value={count(STATUS_TABS[0]!)} label="Open" tone="text-blue" />
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
              {t.label} <span className={i === tab ? "text-white/60" : "text-muted"}>{count(t)}</span>
            </button>
          ))}
        </div>
        {cta}
      </div>

      <ErrorBox message={error} />
      {bounties === null && !error && <p className="text-sm text-muted">Loading…</p>}

      {bounties && shown.length === 0 && (
        <EmptyState icon="⚡" title="Nothing here yet" text={current.empty} action={cta} />
      )}

      <ul className="grid gap-5 md:grid-cols-2">
        {shown.map((b) => (
          <li key={b.id}>
            <Link to={`/b/${b.id}`} className="card block h-full bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_#1e1e1e]">
              <div className="flex items-start justify-between gap-3">
                <span className="flex min-w-0 flex-wrap gap-1.5">
                  {b.repoFullName ? <Tag>{b.repoFullName}</Tag> : b.repoUrl ? <Tag>{new URL(b.repoUrl).hostname}</Tag> : <Tag>No repo</Tag>}
                  {b.issueNumber && <Tag tone="green">#{b.issueNumber}</Tag>}
                </span>
                <StatusPill status={b.status} />
              </div>
              <h3 className="mt-4 font-display text-xl font-bold leading-tight">{b.title}</h3>
              <p className="mt-2 line-clamp-2 text-sm text-muted">{b.description}</p>
              <div className="mt-5 flex items-end justify-between gap-3 border-t border-ink/15 pt-4">
                <div className="label flex items-center gap-2 text-muted">
                  <Avatar src={b.poster.avatarUrl} alt={b.poster.login} size={20} /> {b.poster.login}
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
