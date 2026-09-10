import type {
  Bounty, BountyDetail, CreateBountyInput, CreateSubmissionInput, GithubIssue, GithubPull, GithubRepo,
  MeResponse, MySubmission, PublicBounty, PublicUser, StatusChange, Submission, UserRole,
} from "@boltbounty/shared";

const BASE = "/api";

async function call<T>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(BASE + path, {
    method,
    headers: body === undefined ? headers : { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `${method} ${path} failed with ${res.status}`);
  return json;
}

export const api = {
  me: () => call<MeResponse>("GET", "/me"),
  setRole: (role: UserRole) => call<PublicUser>("POST", "/me/role", { role }),
  mySubmissions: () => call<MySubmission[]>("GET", "/me/submissions"),
  logout: () => call<{ ok: true }>("POST", "/auth/logout"),
  repos: () => call<GithubRepo[]>("GET", "/github/repos"),
  pulls: (fullName: string) => call<GithubPull[]>("GET", `/github/repos/${fullName}/pulls`),
  issues: (fullName: string) => call<GithubIssue[]>("GET", `/github/repos/${fullName}/issues`),
  issue: (fullName: string, number: number) => call<GithubIssue>("GET", `/github/repos/${fullName}/issues/${number}`),

  list: () => call<PublicBounty[]>("GET", "/bounties"),
  get: (id: string) => call<BountyDetail>("GET", `/bounties/${id}`),
  create: (input: CreateBountyInput) => call<Bounty>("POST", "/bounties", input),
  submit: (id: string, input: CreateSubmissionInput) => call<Submission>("POST", `/bounties/${id}/submissions`, input),
  // Poster actions authenticate with the session cookie.
  approve: (id: string, submissionId: string) => call<PublicBounty>("POST", `/bounties/${id}/approve`, { submissionId }),
  reject: (id: string, submissionId: string) => call<PublicBounty>("POST", `/bounties/${id}/reject`, { submissionId }),
  cancel: (id: string) => call<PublicBounty>("POST", `/bounties/${id}/cancel`),
  retryPayout: (id: string) => call<PublicBounty>("POST", `/bounties/${id}/retry-payout`),
};

// Parses https://github.com/owner/repo/issues/123 into its parts.
export function parseIssueUrl(url: string): { fullName: string; number: number } | null {
  const m = url.trim().match(/^https?:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/issues\/(\d+)/);
  return m ? { fullName: m[1]!, number: Number(m[2]) } : null;
}

export const signInUrl = (returnTo: string) => `${BASE}/auth/github?returnTo=${encodeURIComponent(returnTo)}`;

// Server-sent events. Pass "/events" for the board or "/bounties/:id/events" for one bounty.
export function subscribe(path: string, onStatus: (change: StatusChange) => void): () => void {
  const source = new EventSource(BASE + path);
  source.addEventListener("status", (e) => onStatus(JSON.parse((e as MessageEvent).data) as StatusChange));
  return () => source.close();
}
