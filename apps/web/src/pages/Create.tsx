import type { Bounty, BountyStatus } from "@boltbounty/shared";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, secrets, subscribe } from "../api";
import { CopyButton, Hash } from "../components/Copy";
import { Progress } from "../components/Progress";
import { StatusPill } from "../components/StatusPill";
import { Button, Card, CardTitle, ErrorBox, Field, Input, Spinner, Textarea } from "../components/ui";
import { sats } from "../format";

const QUICK_AMOUNTS = [5_000, 20_000, 50_000];

export function Create() {
  const [bounty, setBounty] = useState<Bounty | null>(null);
  const [status, setStatus] = useState<BountyStatus>("unfunded");
  const [amount, setAmount] = useState(20_000);
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
        amountSats: amount,
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
      <div className="mx-auto max-w-2xl space-y-5">
        <div>
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-semibold tracking-tight">{bounty.title}</h1>
            <StatusPill status={status} />
          </div>
          <p className="mt-1 text-sm text-stone-600">{sats(bounty.amountSats)}</p>
          <div className="mt-4"><Progress status={status} /></div>
        </div>

        {status === "unfunded" ? (
          <Card>
            <CardTitle hint="Pay this hold invoice from your Lightning node. The sats lock in flight and stay yours until you approve the work.">
              Step 2 · Fund the escrow
            </CardTitle>
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
              <div className="rounded-xl border border-stone-200 bg-white p-3">
                <QRCodeSVG value={bounty.holdInvoice.toUpperCase()} size={184} />
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <Textarea readOnly value={bounty.holdInvoice} rows={5} className="font-mono text-xs" />
                <div className="flex flex-wrap items-center gap-3">
                  <CopyButton value={bounty.holdInvoice} label="Copy invoice" />
                  <span className="flex items-center gap-2 text-sm text-stone-600"><Spinner /> Waiting for payment…</span>
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
            <Link to={`/b/${bounty.id}`} className="mt-4 inline-block"><Button>Open the bounty</Button></Link>
          </Card>
        )}

        <Card tone="amber">
          <CardTitle hint="Shown once. You need it to approve, reject, or cancel. This browser has kept a copy, so you only need it elsewhere.">
            Your poster secret
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-md bg-white px-2 py-1 font-mono text-sm">{bounty.posterSecret}</code>
            <CopyButton value={bounty.posterSecret} />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight">Post a bounty</h1>
      <p className="mt-1 text-sm text-stone-600">You will get a hold invoice to pay. Nothing leaves your node until you approve the work.</p>

      <Card className="mt-6 space-y-5">
        <Field id="title" label="Title">
          <Input id="title" name="title" required minLength={3} maxLength={120} placeholder="Fix broken link in README" />
        </Field>
        <Field id="description" label="What needs doing" hint="Say how you will judge it done. Workers see this before they start.">
          <Textarea id="description" name="description" required rows={4} placeholder="The docs link in the README returns 404. Fix it and open a PR." />
        </Field>
        <Field id="repoUrl" label="Repository URL" hint="Optional.">
          <Input id="repoUrl" name="repoUrl" type="url" placeholder="https://github.com/you/repo" />
        </Field>
        <Field id="amount" label="Reward" hint="100 to 1,000,000 sats. The worker's payout invoice must match this exactly.">
          <div className="mt-1.5 flex flex-wrap gap-2">
            {QUICK_AMOUNTS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAmount(a)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${amount === a ? "border-amber-400 bg-amber-100 text-amber-900" : "border-stone-300 bg-white text-stone-700 hover:bg-stone-100"}`}
              >
                {a.toLocaleString()} sats
              </button>
            ))}
          </div>
          <div className="relative">
            <Input id="amount" name="amountSats" type="number" required min={100} max={1_000_000} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="pr-12 tabular-nums" />
            <span className="pointer-events-none absolute bottom-0 right-3 top-1.5 flex items-center text-xs text-stone-500">sats</span>
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
