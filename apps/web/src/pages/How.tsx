import { Link } from "react-router-dom";
import { Button } from "../components/ui";

const STEPS = [
  { icon: "🔒", title: "Lock", text: "The poster pays a hold invoice. The HTLC is accepted but not settled, so the sats sit locked in flight on the poster's own channel." },
  { icon: "🛠️", title: "Deliver", text: "A worker submits a link to the work plus a Lightning invoice for the bounty amount. The escrow stays locked while the poster reviews." },
  { icon: "⚡", title: "Release", text: "Approve reveals the preimage: the hold invoice settles and the worker's invoice is paid within seconds. Reject or expire cancels the hold, and the poster's payment simply fails back." },
];

export function How() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">How the escrow works</h1>
        <p className="mt-1 text-sm text-stone-600">No smart contract, no custodian, no on-chain footprint. The lock is a property of the Lightning payment itself.</p>
      </div>

      <ol className="grid gap-3 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="relative rounded-xl border border-stone-200 bg-white p-5">
            <span className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-xs font-semibold text-stone-900">{i + 1}</span>
            <div className="text-2xl">{s.icon}</div>
            <div className="mt-2 font-semibold">{s.title}</div>
            <p className="mt-1 text-sm leading-relaxed text-stone-600">{s.text}</p>
          </li>
        ))}
      </ol>

      <section className="space-y-3 rounded-xl border border-stone-200 bg-white p-5 text-sm leading-relaxed text-stone-800">
        <h2 className="text-base font-semibold">Hold invoices in one paragraph</h2>
        <p>
          A normal Lightning invoice settles the instant the payment arrives, because the receiving node already knows the
          preimage. A hold invoice is created from the hash alone. When the poster pays it, the HTLC reaches the platform
          node and is <em>accepted</em>, but the node cannot settle it without the preimage, which the platform keeps aside.
          The sats are neither with the poster nor with the platform: they are committed in the channel and can only go one
          of two ways. Settle, and they move forward. Cancel, and every hop unwinds with no transaction and no fee.
        </p>
        <p className="text-stone-600">
          Next step: have the worker generate the preimage instead of the platform, so approval settles both legs atomically
          and the platform never holds funds at all.
        </p>
      </section>

      <div className="flex gap-2">
        <Link to="/new"><Button>Post a bounty</Button></Link>
        <Link to="/"><Button variant="secondary">See the board</Button></Link>
      </div>
    </div>
  );
}
