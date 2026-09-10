import type { BountyDetail as Detail } from "@boltbounty/shared";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { api, signInUrl, subscribe } from "../api";
import { useAuth } from "../auth";
import { Hash } from "../components/Copy";
import { Progress } from "../components/Progress";
import { PullPicker } from "../components/PullPicker";
import { StatusPill } from "../components/StatusPill";
import { Avatar, Button, Card, CardTitle, ErrorBox, Field, Input, Spinner, Tag, Textarea, type Tone } from "../components/ui";
import { ago, sats, timeLeft } from "../format";

export function BountyDetail() {
  const { id = "" } = useParams();
  const { me, role } = useAuth();
  const [bounty, setBounty] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = useCallback(() => api.get(id).then(setBounty).catch((e: Error) => setError(e.message)), [id]);

  useEffect(() => {
    reload();
    return subscribe(`/bounties/${id}/events`, () => reload());
  }, [id, reload]);

  // Runs a poster or worker action and surfaces the API's error message.
  async function run(key: string, action: () => Promise<unknown>) {
    setError(null);
    setBusy(key);
    try {
      await action();
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (!bounty) return <p className="text-sm text-muted">{error ?? "Loading…"}</p>;

  const isPoster = me !== null && me.id === bounty.posterUserId;
  const pending = bounty.submissions.filter((s) => !s.decision);
  const failedPayout = bounty.submissions.find((s) => s.decision === "approved" && s.payoutError);
  const open = bounty.status === "funded" && pending.length === 0;

  return (
    <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
      <div className="space-y-6">
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            {bounty.repoFullName ? (
              <a href={bounty.repoUrl!} target="_blank" rel="noreferrer"><Tag>{bounty.repoFullName} ↗</Tag></a>
            ) : bounty.repoUrl ? (
              <a href={bounty.repoUrl} target="_blank" rel="noreferrer"><Tag>{new URL(bounty.repoUrl).hostname} ↗</Tag></a>
            ) : null}
            {bounty.issueUrl && bounty.issueNumber && (
              <a href={bounty.issueUrl} target="_blank" rel="noreferrer" title={bounty.issueTitle ?? undefined}><Tag tone="green">Issue #{bounty.issueNumber} ↗</Tag></a>
            )}
            <StatusPill status={bounty.status} />
          </div>
          <h1 className="display text-3xl sm:text-5xl">{bounty.title}</h1>
          <div className="label mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-muted">
            <span className="flex items-center gap-2"><Avatar src={bounty.poster.avatarUrl} alt={bounty.poster.login} size={20} /> {bounty.poster.login}</span>
            <span>Posted {ago(bounty.createdAt)}</span>
            {timeLeft(bounty.expiresAt, bounty.status) && <span>{timeLeft(bounty.expiresAt, bounty.status)}</span>}
          </div>
          <div className="mt-5"><Progress status={bounty.status} /></div>
        </div>

        <Card>
          <CardTitle>Brief</CardTitle>
          {bounty.issueUrl && (
            <p className="mb-3 text-sm">
              Funds <a href={bounty.issueUrl} target="_blank" rel="noreferrer" className="underline decoration-brand decoration-2 underline-offset-2">issue #{bounty.issueNumber}: {bounty.issueTitle}</a>.
              A PR that references #{bounty.issueNumber} is the expected deliverable.
            </p>
          )}
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{bounty.description}</p>
        </Card>

        <ErrorBox message={error} />

        <section>
          <h2 className="label mb-3 font-semibold">Submissions · {bounty.submissions.length}</h2>
          {bounty.submissions.length === 0 && <p className="text-sm text-muted">No one has submitted work yet.</p>}
          <ul className="space-y-3">
            {bounty.submissions.map((s) => (
              <li key={s.id} className="card bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <Avatar src={s.worker.avatarUrl} alt={s.worker.login} size={20} />
                    {s.workerName}
                  </span>
                  <Tag tone={s.decision === "approved" ? "green" : s.decision === "rejected" ? "pink" : "yellow"}>{s.decision ?? "awaiting decision"}</Tag>
                </div>
                <a href={s.workUrl} className="mt-2 block truncate text-sm underline decoration-brand decoration-2 underline-offset-2" target="_blank" rel="noreferrer">
                  {s.prNumber ? <><span className="font-mono text-muted">#{s.prNumber}</span> {s.prTitle ?? s.workUrl}</> : s.workUrl}
                </a>
                {s.notes && <p className="mt-2 text-sm text-muted">{s.notes}</p>}
                {s.payoutError && <p className="mt-2 border border-ink bg-pink-soft px-2 py-1 text-sm">Payout failed: {s.payoutError}</p>}
                {isPoster && !s.decision && bounty.status === "submitted" && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="success" disabled={busy !== null} onClick={() => run("approve", () => api.approve(id, s.id))}>
                      {busy === "approve" ? <><Spinner /> Settling and paying</> : "Approve and pay"}
                    </Button>
                    <Button variant="secondary" disabled={busy !== null} onClick={() => run("reject", () => api.reject(id, s.id))}>Reject</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <aside className="space-y-6">
        <Card tone={escrowTone(bounty)}>
          <CardTitle hint={escrowText(bounty)}>{escrowTitle(bounty)}</CardTitle>
          <div className="font-display text-4xl font-bold tabular-nums">{bounty.amountSats.toLocaleString()} <span className="label text-muted">sats</span></div>
          <div className="mt-4 space-y-2">
            <Hash label="Hold invoice" value={bounty.paymentHash} />
            {bounty.payoutPaymentHash && <Hash label="Payout" value={bounty.payoutPaymentHash} />}
          </div>
        </Card>

        {isPoster && (bounty.status === "funded" || failedPayout) && (
          <Card>
            <CardTitle tag={<Tag tone="ink">Poster</Tag>} hint="You created this bounty.">Your actions</CardTitle>
            <div className="flex flex-col gap-2">
              {bounty.status === "funded" && (
                <Button variant="danger" disabled={busy !== null} onClick={() => run("cancel", () => api.cancel(id))}>
                  {busy === "cancel" ? <><Spinner /> Cancelling</> : "Cancel and release the sats"}
                </Button>
              )}
              {failedPayout && (
                <Button disabled={busy !== null} onClick={() => run("retry", () => api.retryPayout(id))}>
                  {busy === "retry" ? <><Spinner /> Paying</> : "Retry payout"}
                </Button>
              )}
            </div>
          </Card>
        )}

        {open && !me && (
          <Card tone="blue">
            <CardTitle tag={<Tag tone="ink">Workers</Tag>} hint="Sign in to pick one of your pull requests and paste a payout invoice.">Claim this bounty</CardTitle>
            <a href={signInUrl(`/b/${id}`)}><Button>Sign in with GitHub</Button></a>
          </Card>
        )}
        {open && me && role === "worker" && <SubmitForm bounty={bounty} onDone={reload} onError={setError} />}
        {open && me && role === "poster" && !isPoster && (
          <Card>
            <CardTitle tag={<Tag tone="ink">Posters</Tag>} hint="Only worker accounts can claim bounties. This one is waiting for a worker.">Open for claims</CardTitle>
          </Card>
        )}
      </aside>
    </div>
  );
}

function escrowTone(b: Detail): Tone {
  switch (b.status) {
    case "funded": case "submitted": return "yellow";
    case "paid": return "green";
    case "unfunded": return "white";
    default: return "pink";
  }
}

function escrowTitle(b: Detail): string {
  switch (b.status) {
    case "unfunded": return "Waiting for funding";
    case "funded": return "🔒 Locked in escrow";
    case "submitted": return "🔒 Still locked";
    case "paid": return "Released to the worker";
    case "cancelled": return "Returned to the poster";
    case "expired": return "Expired, returned";
  }
}

function escrowText(b: Detail): string {
  switch (b.status) {
    case "unfunded": return "The poster has not paid the hold invoice yet.";
    case "funded": return "The poster's payment is accepted and held. Not spendable by the poster, the platform, or anyone else.";
    case "submitted": return "Work is in. The escrow stays locked until the poster decides.";
    case "paid": return "The hold invoice settled and the worker's invoice was paid in the same moment.";
    case "cancelled": return "The hold invoice was cancelled. The poster's payment failed back to their node.";
    case "expired": return "No approval before expiry. The hold invoice was cancelled and the sats unwound.";
  }
}

function SubmitForm({ bounty, onDone, onError }: { bounty: Detail; onDone: () => void; onError: (m: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [pr, setPr] = useState<number | null>(null);
  const [useLink, setUseLink] = useState(!bounty.repoFullName);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (!useLink && pr === null) return onError("Pick a pull request, or switch to a link.");
    setBusy(true);
    try {
      await api.submit(bounty.id, {
        workUrl: useLink ? String(f.get("workUrl")) : undefined,
        prNumber: useLink ? undefined : pr!,
        notes: String(f.get("notes") ?? ""),
        payoutInvoice: String(f.get("payoutInvoice")).trim(),
      });
      onDone();
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card tone="blue">
      <form onSubmit={onSubmit} className="space-y-4">
        <CardTitle tag={<Tag tone="ink">Worker</Tag>} hint={`Pick your pull request and paste an invoice from your node for exactly ${sats(bounty.amountSats)}. You are paid the moment the poster approves.`}>
          Claim this bounty
        </CardTitle>
        {bounty.repoFullName && !useLink ? (
          <Field id="pr" label="Pull request">
            <PullPicker repoFullName={bounty.repoFullName} issueNumber={bounty.issueNumber} value={pr} onChange={setPr} />
            <button type="button" onClick={() => setUseLink(true)} className="label mt-2 text-muted underline">Use a link instead</button>
          </Field>
        ) : (
          <Field id="workUrl" label="Link to the work">
            <Input id="workUrl" name="workUrl" type="url" required placeholder="https://github.com/…/pull/1" />
            {bounty.repoFullName && (
              <button type="button" onClick={() => setUseLink(false)} className="label mt-2 text-muted underline">Pick a pull request instead</button>
            )}
          </Field>
        )}
        <Field id="notes" label="Notes" hint="Optional.">
          <Textarea id="notes" name="notes" rows={2} placeholder="What you changed and anything the poster should check." />
        </Field>
        <Field id="payoutInvoice" label={`Payout invoice · ${sats(bounty.amountSats)}`} hint="A BOLT11 invoice from your node. Any other amount is rejected.">
          <Textarea id="payoutInvoice" name="payoutInvoice" required rows={3} placeholder="lnbcrt…" className="font-mono text-xs" />
        </Field>
        <Button disabled={busy} className="w-full">{busy ? <><Spinner /> Checking invoice</> : "Submit work"}</Button>
      </form>
    </Card>
  );
}
