import type {
  Bounty, BountyDetail, CreateBountyInput, CreateSubmissionInput, GithubPull, GithubRepo,
  MeResponse, PublicBounty, StatusChange, Submission,
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

const poster = (secret: string | null): Record<string, string> => (secret ? { "x-poster-secret": secret } : {});

export const api = {
  me: () => call<MeResponse>("GET", "/me"),
  logout: () => call<{ ok: true }>("POST", "/auth/logout"),
  repos: () => call<GithubRepo[]>("GET", "/github/repos"),
  pulls: (fullName: string) => call<GithubPull[]>("GET", `/github/repos/${fullName}/pulls`),

  list: () => call<PublicBounty[]>("GET", "/bounties"),
  get: (id: string) => call<BountyDetail>("GET", `/bounties/${id}`),
  create: (input: CreateBountyInput) => call<Bounty>("POST", "/bounties", input),
  submit: (id: string, input: CreateSubmissionInput) => call<Submission>("POST", `/bounties/${id}/submissions`, input),
  // Poster actions authenticate with the session cookie; the secret is the guest-mode fallback.
  approve: (id: string, secret: string | null, submissionId: string) => call<PublicBounty>("POST", `/bounties/${id}/approve`, { submissionId }, poster(secret)),
  reject: (id: string, secret: string | null, submissionId: string) => call<PublicBounty>("POST", `/bounties/${id}/reject`, { submissionId }, poster(secret)),
  cancel: (id: string, secret: string | null) => call<PublicBounty>("POST", `/bounties/${id}/cancel`, undefined, poster(secret)),
  retryPayout: (id: string, secret: string | null) => call<PublicBounty>("POST", `/bounties/${id}/retry-payout`, undefined, poster(secret)),
};

export const signInUrl = (returnTo: string) => `${BASE}/auth/github?returnTo=${encodeURIComponent(returnTo)}`;

// Server-sent events. Pass "/events" for the board or "/bounties/:id/events" for one bounty.
export function subscribe(path: string, onStatus: (change: StatusChange) => void): () => void {
  const source = new EventSource(BASE + path);
  source.addEventListener("status", (e) => onStatus(JSON.parse((e as MessageEvent).data) as StatusChange));
  return () => source.close();
}

// Guest-mode poster auth. Lives in this browser's localStorage only.
export const secrets = {
  get: (bountyId: string) => localStorage.getItem(`boltbounty:secret:${bountyId}`),
  set: (bountyId: string, secret: string) => localStorage.setItem(`boltbounty:secret:${bountyId}`, secret),
};
