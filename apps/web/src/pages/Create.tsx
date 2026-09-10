import type { Bounty, BountyStatus, GithubIssue, GithubRepo } from "@boltbounty/shared";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, parseIssueUrl, signInUrl, subscribe } from "../api";
import { useAuth } from "../auth";
import { CopyButton, Hash } from "../components/Copy";
import { IssuePicker } from "../components/IssuePicker";
import { Progress } from "../components/Progress";
import { RepoPicker } from "../components/RepoPicker";
import { StatusPill } from "../components/StatusPill";
import { Button, Card, CardTitle, ErrorBox, Field, Input, Spinner, Tag, Textarea } from "../components/ui";
import { sats } from "../format";

const QUICK_AMOUNTS = [5_000, 20_000, 50_000];

export function Create() {
  const { me, role, loading } = useAuth();
  const [bounty, setBounty] = useState<Bounty | null>(null);
  const [status, setStatus] = useState<BountyStatus>("unfunded");
  const [repo, setRepo] = useState<GithubRepo | null>(null);
  const [issue, setIssue] = useState<GithubIssue | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(20_000);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [params] = useSearchParams();

  // "Fund from GitHub": /new?issue=https://github.com/owner/repo/issues/123
  // arrives with the repo and issue preselected.
  useEffect(() => {
    const parsed = parseIssueUrl(params.get("issue") ?? "");
    if (!parsed || !me || me.role !== "poster") return;
    const [owner, name] = parsed.fullName.split("/") as [string, string];
    setRepo({ fullName: parsed.fullName, name, owner, url: `https://github.com/${parsed.fullName}`, description: null, private: false, updatedAt: "" });
    api.issue(parsed.fullName, parsed.number).then(pickIssue).catch((e: Error) => setError(e.message));
  }, [params, me]);

  function pickIssue(i: GithubIssue | null) {
    setIssue(i);
    if (i) {
      setTitle(i.title);
      setDescription(i.body || `Resolve ${i.url}`);
    }
  }

  function pickRepo(r: GithubRepo | null) {
    setRepo(r);
    setIssue(null);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const b = await api.create({
        title: String(f.get("title")),
        description: String(f.get("description")),
        repoFullName: repo?.fullName ?? null,
        issueNumber: issue?.number ?? null,
        repoUrl: null,
        amountSats: amount,
      });
      setBounty(b);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Flip to "funded" the moment the watcher sees the HTLC accepted.
  useEffect(() => {
    if (!bounty) return;
    return subscribe(`/bounties/${bounty.id}/events`, (c) => setStatus(c.to));
  }, [bounty]);

  if (bounty) return <Funding bounty={bounty} status={status} />;

  if (loading) return <p className="text-sm text-muted">Loading…</p>;

  if (!me) {
    return (
      <div className="mx-auto max-w-xl">
        <Card tone="yellow">
          <CardTitle tag={<Tag tone="ink">Posters</Tag>} hint="Your GitHub account is the poster identity. You pick one of your repositories, and only you can approve or cancel the bounty.">
            Sign in to post a bounty
          </CardTitle>
          <a href={signInUrl("/new")}><Button>Sign in with GitHub</Button></a>
        </Card>
      </div>
    );
  }

  if (role !== "poster") {
    return (
      <div className="mx-auto max-w-xl">
        <Card tone="blue">
          <CardTitle tag={<Tag tone="ink">Workers</Tag>} hint="This account is a worker account. Workers claim bounties; only poster accounts can fund them.">
            Posting is for poster accounts
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Link to="/"><Button>Find work instead</Button></Link>
            <Link to="/role"><Button variant="secondary">Review my role</Button></Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-6">
      <div>
        <Tag tone="ink">Step 1 of 2</Tag>
        <h1 className="display mt-3 text-4xl sm:text-5xl">Post a bounty<span className="text-brand">.</span></h1>
        <p className="mt-3 text-muted">You get a hold invoice to pay next. Nothing leaves your node until you approve the work.</p>
      </div>

      <Card className="space-y-5">
        <Field id="repo" label="Repository" hint="Workers will submit a pull request against this repo.">
          <RepoPicker value={repo} onChange={pickRepo} />
        </Field>
        {repo && (
          <Field id="issue" label="GitHub issue" hint="Optional. Ties the bounty to the issue: the title and brief prefill, and BoltBounty comments on the issue when it is funded and paid.">
            <IssuePicker repoFullName={repo.fullName} value={issue} onChange={pickIssue} />
          </Field>
        )}
        <Field id="title" label="Title">
          <Input id="title" name="title" required minLength={3} maxLength={120} placeholder="Fix broken link in README" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field id="description" label="What needs doing" hint="Say how you will judge it done. Workers read this before they start.">
          <Textarea id="description" name="description" required rows={4} placeholder="The docs link in the README returns 404. Fix it and open a PR." value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field id="amount" label="Reward" hint="100 to 1,000,000 sats. The worker's payout invoice must match this exactly.">
          <div className="mt-1.5 flex flex-wrap gap-2">
            {QUICK_AMOUNTS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAmount(a)}
                className={`label border-2 border-ink px-3 py-1.5 font-semibold transition ${amount === a ? "bg-yellow-soft shadow-hard-sm" : "bg-white hover:bg-paper"}`}
              >
                {a.toLocaleString()} sats
              </button>
            ))}
          </div>
          <div className="relative">
            <Input id="amount" name="amountSats" type="number" required min={100} max={1_000_000} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="pr-14 font-mono" />
            <span className="label pointer-events-none absolute bottom-0 right-3 top-1.5 flex items-center text-muted">sats</span>
          </div>
        </Field>
        <ErrorBox message={error} />
        <Button disabled={busy} className="w-full">
          {busy ? <><Spinner /> Creating hold invoice…</> : "Create bounty and get invoice"}
        </Button>
      </Card>
    </form>
  );
}

function Funding({ bounty, status }: { bounty: Bounty; status: BountyStatus }) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <div className="flex items-start justify-between gap-4">
          <h1 className="display text-3xl sm:text-4xl">{bounty.title}</h1>
          <StatusPill status={status} />
        </div>
        <p className="mt-2 font-mono text-sm">{sats(bounty.amountSats)}</p>
        <div className="mt-4"><Progress status={status} /></div>
      </div>

      {status === "unfunded" ? (
        <Card>
          <CardTitle tag={<Tag tone="ink">Step 2 of 2</Tag>} hint="Pay this hold invoice from your Lightning node. The sats lock in flight and stay yours until you approve the work.">
            Fund the escrow
          </CardTitle>
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
            <div className="border-2 border-ink bg-white p-3">
              <QRCodeSVG value={bounty.holdInvoice.toUpperCase()} size={184} />
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <Textarea readOnly value={bounty.holdInvoice} rows={5} className="mt-0 font-mono text-xs" />
              <div className="flex flex-wrap items-center gap-3">
                <CopyButton value={bounty.holdInvoice} label="Copy invoice" />
                <span className="label flex items-center gap-2 text-muted"><Spinner /> Waiting for payment</span>
              </div>
              <Hash label="Payment hash" value={bounty.paymentHash} />
            </div>
          </div>
        </Card>
      ) : (
        <Card tone="green">
          <CardTitle hint="The HTLC is accepted and held. Nobody, including the platform, can spend these sats until you approve.">
            🔒 Funded and escrowed
          </CardTitle>
          <Hash label="Payment hash" value={bounty.paymentHash} />
          <Link to={`/b/${bounty.id}`} className="mt-5 inline-block"><Button>Open the bounty</Button></Link>
        </Card>
      )}
    </div>
  );
}
