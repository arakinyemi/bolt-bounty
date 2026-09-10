import { Link } from "react-router-dom";
import { Button, Card, Tag, type Tone } from "../components/ui";

const STEPS: { tone: Tone; title: string; text: string }[] = [
  { tone: "yellow", title: "Lock", text: "The poster pays a hold invoice. The HTLC is accepted but not settled, so the sats sit locked in flight on the poster's own channel." },
  { tone: "blue", title: "Deliver", text: "A worker submits a pull request plus a Lightning invoice for the bounty amount. The escrow stays locked while the poster reviews." },
  { tone: "green", title: "Release", text: "Approve reveals the preimage: the hold invoice settles and the worker's invoice is paid within seconds. Reject or expire cancels the hold, and the poster's payment simply fails back." },
];

export function How() {
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div>
        <Tag tone="ink">How it works</Tag>
        <h1 className="display mt-3 text-4xl sm:text-6xl">Escrow without<br />a custodian<span className="text-brand">.</span></h1>
        <p className="mt-4 max-w-xl text-muted">No smart contract, no middleman holding funds, no on-chain footprint. The lock is a property of the Lightning payment itself.</p>
      </div>

      <ol className="grid gap-5 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <Card tone={s.tone} className="h-full">
              <span className="label inline-flex h-7 w-7 items-center justify-center border-2 border-ink bg-ink font-semibold text-white">{i + 1}</span>
              <div className="mt-4 font-display text-2xl font-bold">{s.title}</div>
              <p className="mt-2 text-sm leading-relaxed">{s.text}</p>
            </Card>
          </li>
        ))}
      </ol>

      <Card className="space-y-3 text-sm leading-relaxed">
        <h2 className="font-display text-xl font-bold">Hold invoices in one paragraph</h2>
        <p>
          A normal Lightning invoice settles the instant the payment arrives, because the receiving node already knows the
          preimage. A hold invoice is created from the hash alone. When the poster pays it, the HTLC reaches the platform
          node and is <em>accepted</em>, but the node cannot settle it without the preimage, which the platform keeps aside.
          The sats are neither with the poster nor with the platform: they are committed in the channel and can only go one
          of two ways. Settle, and they move forward. Cancel, and every hop unwinds with no transaction and no fee.
        </p>
        <p className="text-muted">
          Next step: have the worker generate the preimage instead of the platform, so approval settles both legs atomically
          and the platform never holds funds at all.
        </p>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Link to="/new"><Button>Post a bounty</Button></Link>
        <Link to="/"><Button variant="secondary">See the board</Button></Link>
      </div>
    </div>
  );
}
