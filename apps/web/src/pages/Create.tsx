import type { Bounty, BountyStatus } from "@boltbounty/shared";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, secrets, subscribe } from "../api";
import { CopyButton, Hash } from "../components/Copy";
import { StatusPill } from "../components/StatusPill";
import { sats } from "../format";

export function Create() {
  const [bounty, setBounty] = useState<Bounty | null>(null);
  const [status, setStatus] = useState<BountyStatus>("unfunded");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const b = await api.create({
        title: String(f.get("title")),
        description: String(f.get("description")),
        repoUrl: String(f.get("repoUrl")) || null,
        amountSats: Number(f.get("amountSats")),
      });
      secrets.set(b.id, b.posterSecret);
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

  if (bounty) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold">{bounty.title}</h1>
          <div className="mt-1 flex items-center gap-3 text-sm">
            <span className="font-mono">{sats(bounty.amountSats)}</span>
            <StatusPill status={status} />
          </div>
        </div>

        <section className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <h2 className="font-medium">Save your poster secret</h2>
          <p className="mt-1 text-sm text-amber-900">
            It is shown once. You need it to approve, reject, or cancel. This browser has kept a copy.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="rounded bg-white px-2 py-1 font-mono text-sm">{bounty.posterSecret}</code>
            <CopyButton value={bounty.posterSecret} />
          </div>
        </section>

        {status === "unfunded" ? (
          <section className="rounded-lg border bg-white p-4">
            <h2 className="font-medium">Fund the escrow</h2>
            <p className="mt-1 text-sm text-gray-600">
              Pay this hold invoice from your node. The sats lock in flight and cannot be spent by anyone until you approve.
            </p>
            <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <QRCodeSVG value={bounty.holdInvoice.toUpperCase()} size={200} />
              <div className="min-w-0 flex-1">
                <textarea readOnly value={bounty.holdInvoice} rows={6} className="w-full rounded border p-2 font-mono text-xs" />
                <div className="mt-2 flex items-center gap-3">
                  <CopyButton value={bounty.holdInvoice} label="Copy invoice" />
                  <span className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
                    Waiting for funding…
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <Hash label="Payment hash" value={bounty.paymentHash} />
            </div>
          </section>
        ) : (
          <section className="rounded-lg border border-green-300 bg-green-50 p-4">
            <h2 className="font-medium">Funded and escrowed</h2>
            <p className="mt-1 text-sm text-green-900">The HTLC is accepted. Nobody, including the platform, can spend these sats.</p>
            <div className="mt-2"><Hash label="Payment hash" value={bounty.paymentHash} /></div>
            <Link to={`/b/${bounty.id}`} className="mt-3 inline-block rounded bg-gray-900 px-3 py-1.5 text-sm text-white">
              Open bounty
            </Link>
          </section>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="max-w-lg space-y-4">
      <h1 className="text-xl font-semibold">Post a bounty</h1>
      <label className="block text-sm">
        Title
        <input name="title" required minLength={3} maxLength={120} className="mt-1 w-full rounded border p-2" placeholder="Fix broken link in README" />
      </label>
      <label className="block text-sm">
        Description
        <textarea name="description" required rows={4} className="mt-1 w-full rounded border p-2" placeholder="What needs doing and how you will judge it." />
      </label>
      <label className="block text-sm">
        Repository URL (optional)
        <input name="repoUrl" type="url" className="mt-1 w-full rounded border p-2" placeholder="https://github.com/…" />
      </label>
      <label className="block text-sm">
        Amount (sats, 100 to 1,000,000)
        <input name="amountSats" type="number" required min={100} max={1_000_000} defaultValue={20_000} className="mt-1 w-full rounded border p-2" />
      </label>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button disabled={busy} className="rounded bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50">
        {busy ? "Creating hold invoice…" : "Create bounty"}
      </button>
    </form>
  );
}
