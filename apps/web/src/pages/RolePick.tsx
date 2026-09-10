import type { UserRole } from "@boltbounty/shared";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInUrl } from "../api";
import { useAuth } from "../auth";
import { Button, Card, ErrorBox, Tag, type Tone } from "../components/ui";

const ROLES: { role: UserRole; tone: Tone; title: string; text: string; bullets: string[]; next: string }[] = [
  {
    role: "poster", tone: "yellow", title: "I'm posting work",
    text: "Fund tasks on your repositories and pay when a pull request is good.",
    bullets: ["Pick a repo from your GitHub", "Lock sats in a hold invoice", "Approve, reject, or cancel"],
    next: "/new",
  },
  {
    role: "worker", tone: "blue", title: "I'm doing work",
    text: "Claim funded bounties with a pull request and get paid over Lightning.",
    bullets: ["Browse escrowed bounties", "Submit one of your open PRs", "Paid the moment it's approved"],
    next: "/",
  },
];

export function RolePick() {
  const { me, loading, setRole } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<UserRole | null>(null);

  if (loading) return <p className="text-sm text-muted">Loading…</p>;
  if (!me) {
    return (
      <div className="mx-auto max-w-xl">
        <Card tone="yellow">
          <h1 className="font-display text-2xl font-bold">Sign in to choose a role</h1>
          <p className="mt-2 text-sm">Your GitHub account is your identity on the board.</p>
          <a href={signInUrl("/role")} className="mt-4 inline-block"><Button>Sign in with GitHub</Button></a>
        </Card>
      </div>
    );
  }

  async function choose(role: UserRole, next: string) {
    setError(null);
    setBusy(role);
    try {
      await setRole(role);
      navigate(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <Tag tone="ink">{me.role ? "Your role" : "One last step"}</Tag>
        <h1 className="display mt-3 text-4xl sm:text-5xl">How will you use BoltBounty<span className="text-brand">?</span></h1>
        <p className="mt-3 text-muted">
          Every account is a poster or a worker. {me.role ? "You can change it until the account has bounties or submissions." : "You can change it later, until the account has bounties or submissions."}
        </p>
      </div>
      <ErrorBox message={error} />
      <div className="grid gap-5 sm:grid-cols-2">
        {ROLES.map((r) => (
          <Card key={r.role} tone={r.tone} className="flex flex-col">
            <div className="flex items-center justify-between">
              <Tag tone="ink">{r.role}</Tag>
              {me.role === r.role && <Tag tone="green">current</Tag>}
            </div>
            <h2 className="mt-4 font-display text-2xl font-bold">{r.title}</h2>
            <p className="mt-2 text-sm">{r.text}</p>
            <ul className="label mt-4 space-y-1.5">
              {r.bullets.map((b) => <li key={b}>→ {b}</li>)}
            </ul>
            <div className="mt-6 flex-1" />
            <Button disabled={busy !== null} onClick={() => choose(r.role, r.next)} className="w-full">
              {busy === r.role ? "Saving…" : me.role === r.role ? "Continue" : `Continue as ${r.role}`}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
