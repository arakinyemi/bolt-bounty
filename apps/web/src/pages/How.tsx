const STEPS = [
  { icon: "🔒", title: "Lock", text: "The poster pays a hold invoice. The HTLC is accepted but not settled, so the sats sit locked in flight on the poster's own channel." },
  { icon: "🛠", title: "Deliver", text: "A worker submits a link to the work and a Lightning invoice for the bounty amount. The escrow stays locked while the poster reviews." },
  { icon: "⚡", title: "Release", text: "Approve reveals the preimage: the hold invoice settles and the worker's invoice is paid within seconds. Reject or expire cancels the hold invoice and the poster's payment simply fails back." },
];

export function How() {
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">How the escrow works</h1>
      <ol className="grid gap-3 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="rounded-lg border bg-white p-4">
            <div className="text-2xl">{s.icon}</div>
            <div className="mt-2 font-medium">{i + 1}. {s.title}</div>
            <p className="mt-1 text-sm text-gray-600">{s.text}</p>
          </li>
        ))}
      </ol>
      <section className="space-y-3 text-sm leading-relaxed text-gray-800">
        <h2 className="font-medium">Hold invoices</h2>
        <p>
          A normal Lightning invoice settles the instant the payment arrives, because the receiving node already knows the
          preimage. A hold invoice is created from the hash alone. When the poster pays it, the HTLC reaches the platform
          node and is <em>accepted</em>, but the node cannot settle it without the preimage, which the platform keeps aside. The
          sats are neither with the poster nor with the platform: they are committed in the channel and can only go one of
          two ways. Settle, and they move forward. Cancel, and every hop unwinds with no transaction and no fee. That is the
          whole escrow, with no smart contract, no custodian, and no on-chain footprint.
        </p>
        <p>
          Next step: have the worker generate the preimage instead of the platform, so approval settles both legs atomically
          and the platform never holds funds at all.
        </p>
      </section>
    </div>
  );
}
