import type { BountyDetail as Detail } from "@boltbounty/shared";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { api, secrets, subscribe } from "../api";
import { Hash } from "../components/Copy";
import { Progress } from "../components/Progress";
import { StatusPill } from "../components/StatusPill";
import { Button, Card, CardTitle, ErrorBox, Field, Input, Spinner, Textarea } from "../components/ui";
import { sats, timeLeft } from "../format";

export function BountyDetail() {
  const { id = "" } = useParams();
  const [bounty, setBounty] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const secret = secrets.get(id);

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

  if (!bounty) return <p className="text-sm text-stone-500">{error ?? "Loading…"}</p>;

  const pending = bounty.submissions.filter((s) => !s.decision);
  const failedPayout = bounty.submissions.find((s) => s.decision === "approved" && s.payoutError);
  const isPoster = Boolean(secret);

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">{bounty.title}</h1>
          <StatusPill status={bounty.status} />
        </div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-600">
          <span className="font-medium text-stone-900">{sats(bounty.amountSats)}</span>
          {timeLeft(bounty.expiresAt, bounty.status) && <span>{timeLeft(bounty.expiresAt, bounty.status)}</span>}
          {bounty.repoUrl && <a href={bounty.repoUrl} className="text-amber-700 underline decoration-amber-300 underline-offset-2 hover:text-amber-900" target="_blank" rel="noreferrer">{new URL(bounty.repoUrl).hostname}</a>}
        </div>
        <div className="mt-4"><Progress status={bounty.status} /></div>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-stone-800">{bounty.description}</p>
      </div>

      <Card tone={bounty.status === "funded" || bounty.status === "submitted" ? "amber" : bounty.status === "paid" ? "green" : bounty.status === "unfunded" ? "default" : "rose"}>
        <CardTitle hint={escrowText(bounty)}>{escrowTitle(bounty)}</CardTitle>
        <div className="space-y-1.5">
          <Hash label="Hold invoice hash" value={bounty.paymentHash} />
          {bounty.payoutPaymentHash && <Hash label="Payout hash" value={bounty.payoutPaymentHash} />}
        </div>
      </Card>

      <ErrorBox message={error} />

      <section>
        <h2 className="mb-2 text-base font-semibold">Submissions</h2>
        {bounty.submissions.length === 0 && <p className="text-sm text-stone-500">No one has submitted work yet.</p>}
        <ul className="space-y-2">
          {bounty.submissions.map((s) => (
            <li key={s.id} className="rounded-xl border border-stone-200 bg-white p-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold">{s.workerName}</span>
                <span className={`text-xs font-medium ${s.decision === "approved" ? "text-emerald-700" : s.decision === "rejected" ? "text-rose-700" : "text-stone-500"}`}>
                  {s.decision ?? "awaiting decision"}
                </span>
              </div>
              <a href={s.workUrl} className="mt-1 block truncate text-amber-700 underline decoration-amber-300 underline-offset-2" target="_blank" rel="noreferrer">{s.workUrl}</a>
              {s.notes && <p className="mt-1 text-stone-700">{s.notes}</p>}
              {s.payoutError && <p className="mt-2 rounded-md bg-rose-50 px-2 py-1 text-rose-800">Payout failed: {s.payoutError}</p>}
              {isPoster && !s.decision && bounty.status === "submitted" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="success" disabled={busy !== null} onClick={() => run("approve", () => api.approve(id, secret!, s.id))}>
                    {busy === "approve" ? <><Spinner /> Settling and paying…</> : "Approve and pay"}
                  </Button>
                  <Button variant="secondary" disabled={busy !== null} onClick={() => run("reject", () => api.reject(id, secret!, s.id))}>Reject</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {bounty.status === "funded" && pending.length === 0 && (
        <SubmitForm bountyId={id} amountSats={bounty.amountSats} onDone={reload} onError={setError} />
      )}

      {isPoster && (bounty.status === "funded" || failedPayout) && (
        <Card>
          <CardTitle hint="You hold the poster secret for this bounty in this browser.">Poster actions</CardTitle>
          <div className="flex flex-wrap gap-2">
            {bounty.status === "funded" && (
              <Button variant="danger" disabled={busy !== null} onClick={() => run("cancel", () => api.cancel(id, secret!))}>
                {busy === "cancel" ? <><Spinner /> Cancelling…</> : "Cancel bounty and release the sats"}
              </Button>
            )}
            {failedPayout && (
              <Button disabled={busy !== null} onClick={() => run("retry", () => api.retryPayout(id, secret!))}>
                {busy === "retry" ? <><Spinner /> Paying…</> : "Retry payout"}
              </Button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function escrowTitle(b: Detail): string {
  switch (b.status) {
    case "unfunded": return "Waiting for funding";
    case "funded": return "🔒 Sats locked in escrow";
    case "submitted": return "🔒 Sats still locked";
    case "paid": return "Released to the worker";
    case "cancelled": return "Returned to the poster";
    case "expired": return "Expired, returned to the poster";
  }
}

function escrowText(b: Detail): string {
  switch (b.status) {
    case "unfunded": return "The poster has not paid the hold invoice yet.";
    case "funded": return "The poster's payment is accepted and held. It is not spendable by the poster, the platform, or anyone else.";
    case "submitted": return "Work is in. The escrow stays locked until the poster approves or rejects.";
    case "paid": return "The hold invoice settled and the worker's invoice was paid in the same moment.";
    case "cancelled": return "The hold invoice was cancelled. The poster's payment failed back to their node; no refund transaction was needed.";
    case "expired": return "No approval before expiry. The hold invoice was cancelled and the poster's sats unwound.";
  }
}

function SubmitForm({ bountyId, amountSats, onDone, onError }: { bountyId: string; amountSats: number; onDone: () => void; onError: (m: string) => void }) {
  const [busy, setBusy] = useState(false);
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await api.submit(bountyId, {
        workerName: String(f.get("workerName")),
        workUrl: String(f.get("workUrl")),
        notes: String(f.get("notes")),
        payoutInvoice: String(f.get("payoutInvoice")).trim(),
      } as Parameters<typeof api.submit>[1]);
      onDone();
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <form onSubmit={onSubmit} className="space-y-4">
        <CardTitle hint={`Link your work and paste an invoice from your Lightning node for exactly ${sats(amountSats)}. You are paid the moment the poster approves.`}>
          Claim this bounty
        </CardTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="workerName" label="Your name"><Input id="workerName" name="workerName" required maxLength={80} placeholder="ada" /></Field>
          <Field id="workUrl" label="Link to the work"><Input id="workUrl" name="workUrl" type="url" required placeholder="https://github.com/…/pull/1" /></Field>
        </div>
        <Field id="notes" label="Notes" hint="Optional."><Textarea id="notes" name="notes" rows={2} placeholder="What you changed and anything the poster should check." /></Field>
        <Field id="payoutInvoice" label={`Payout invoice for ${sats(amountSats)}`} hint="A BOLT11 invoice from your node. Any other amount is rejected.">
          <Textarea id="payoutInvoice" name="payoutInvoice" required rows={3} placeholder="lnbcrt…" className="font-mono text-xs" />
        </Field>
        <Button disabled={busy}>{busy ? <><Spinner /> Checking invoice…</> : "Submit work"}</Button>
      </form>
    </Card>
  );
}
