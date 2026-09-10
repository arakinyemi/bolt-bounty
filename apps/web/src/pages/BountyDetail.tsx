import type { BountyDetail as Detail, Submission } from "@boltbounty/shared";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { api, secrets, subscribe } from "../api";
import { Hash } from "../components/Copy";
import { StatusPill } from "../components/StatusPill";
import { sats, timeLeft } from "../format";

export function BountyDetail() {
  const { id = "" } = useParams();
  const [bounty, setBounty] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const secret = secrets.get(id);

  const reload = useCallback(() => api.get(id).then(setBounty).catch((e: Error) => setError(e.message)), [id]);

  useEffect(() => {
    reload();
    return subscribe(`/bounties/${id}/events`, () => reload());
  }, [id, reload]);

  // Runs a poster or worker action and surfaces the API's error message.
  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!bounty) return <p className="text-sm text-gray-500">{error ?? "Loading…"}</p>;

  const pending = bounty.submissions.filter((s) => !s.decision);
  const failedPayout = bounty.submissions.find((s) => s.decision === "approved" && s.payoutError);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-xl font-semibold">{bounty.title}</h1>
          <StatusPill status={bounty.status} />
        </div>
        <div className="mt-1 flex gap-4 text-sm text-gray-600">
          <span className="font-mono">{sats(bounty.amountSats)}</span>
          {timeLeft(bounty.expiresAt, bounty.status) && <span>{timeLeft(bounty.expiresAt, bounty.status)}</span>}
          {bounty.repoUrl && <a href={bounty.repoUrl} className="text-blue-700 underline" target="_blank" rel="noreferrer">Repository</a>}
        </div>
        <p className="mt-3 whitespace-pre-wrap text-sm">{bounty.description}</p>
      </div>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="font-medium">Escrow</h2>
        <p className="mt-1 text-sm text-gray-600">{escrowText(bounty)}</p>
        <div className="mt-2 space-y-1">
          <Hash label="Hold invoice hash" value={bounty.paymentHash} />
          {bounty.payoutPaymentHash && <Hash label="Payout hash" value={bounty.payoutPaymentHash} />}
        </div>
      </section>

      {error && <p className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800">{error}</p>}

      <section>
        <h2 className="font-medium">Submissions</h2>
        {bounty.submissions.length === 0 && <p className="mt-1 text-sm text-gray-500">None yet.</p>}
        <ul className="mt-2 space-y-2">
          {bounty.submissions.map((s) => (
            <li key={s.id} className="rounded-lg border bg-white p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{s.workerName}</span>
                <span className="text-xs text-gray-500">{s.decision ?? "pending"}</span>
              </div>
              <a href={s.workUrl} className="text-blue-700 underline" target="_blank" rel="noreferrer">{s.workUrl}</a>
              {s.notes && <p className="mt-1 text-gray-700">{s.notes}</p>}
              {s.payoutError && <p className="mt-1 text-red-700">Payout failed: {s.payoutError}</p>}
              {secret && !s.decision && bounty.status === "submitted" && (
                <div className="mt-2 flex gap-2">
                  <button onClick={() => run(() => api.approve(id, secret, s.id))} className="rounded bg-green-700 px-3 py-1 text-white">Approve and pay</button>
                  <button onClick={() => run(() => api.reject(id, secret, s.id))} className="rounded border px-3 py-1">Reject</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {secret && (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <h2 className="font-medium">Poster</h2>
          <p className="mt-1 text-sm text-amber-900">This browser holds the poster secret for this bounty.</p>
          <div className="mt-2 flex gap-2">
            {bounty.status === "funded" && (
              <button onClick={() => run(() => api.cancel(id, secret))} className="rounded border border-red-400 px-3 py-1 text-sm text-red-800">
                Cancel bounty and release escrow
              </button>
            )}
            {failedPayout && (
              <button onClick={() => run(() => api.retryPayout(id, secret))} className="rounded bg-gray-900 px-3 py-1 text-sm text-white">
                Retry payout
              </button>
            )}
          </div>
        </section>
      )}

      {bounty.status === "funded" && pending.length === 0 && <SubmitForm bountyId={id} amountSats={bounty.amountSats} onDone={reload} onError={setError} />}
    </div>
  );
}

function escrowText(b: Detail): string {
  switch (b.status) {
    case "unfunded": return "Waiting for the poster to pay the hold invoice.";
    case "funded": return "The poster's HTLC is accepted and held. The sats are locked in flight: not spendable by the poster, the platform, or anyone else.";
    case "submitted": return "Escrow is still locked. The poster decides whether to release it.";
    case "paid": return "Hold invoice settled and the worker's invoice paid.";
    case "cancelled": return "Hold invoice cancelled. The poster's payment failed back to their node; no refund transaction was needed.";
    case "expired": return "Expired before approval. Hold invoice cancelled and the poster's sats unwound.";
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
        payoutInvoice: String(f.get("payoutInvoice")),
      } as Parameters<typeof api.submit>[1]);
      onDone();
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border bg-white p-4">
      <h2 className="font-medium">Submit work</h2>
      <p className="text-sm text-gray-600">Include a Lightning invoice from your node for exactly {sats(amountSats)}.</p>
      <input name="workerName" required maxLength={80} placeholder="Your name" className="w-full rounded border p-2 text-sm" />
      <input name="workUrl" type="url" required placeholder="https://github.com/…/pull/1" className="w-full rounded border p-2 text-sm" />
      <textarea name="notes" rows={2} placeholder="Notes (optional)" className="w-full rounded border p-2 text-sm" />
      <textarea name="payoutInvoice" required rows={3} placeholder="lnbcrt…" className="w-full rounded border p-2 font-mono text-xs" />
      <button disabled={busy} className="rounded bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50">
        {busy ? "Submitting…" : "Submit"}
      </button>
    </form>
  );
}

export type { Submission };
