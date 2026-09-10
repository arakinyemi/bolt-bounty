import type { Bounty, BountyDetail, CreateBountyInput, CreateSubmissionInput, PublicBounty, StatusChange, Submission } from "@boltbounty/shared";

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

const poster = (secret: string) => ({ "x-poster-secret": secret });

export const api = {
  list: () => call<PublicBounty[]>("GET", "/bounties"),
  get: (id: string) => call<BountyDetail>("GET", `/bounties/${id}`),
  create: (input: CreateBountyInput) => call<Bounty>("POST", "/bounties", input),
  submit: (id: string, input: CreateSubmissionInput) => call<Submission>("POST", `/bounties/${id}/submissions`, input),
  approve: (id: string, secret: string, submissionId: string) => call<PublicBounty>("POST", `/bounties/${id}/approve`, { submissionId }, poster(secret)),
  reject: (id: string, secret: string, submissionId: string) => call<PublicBounty>("POST", `/bounties/${id}/reject`, { submissionId }, poster(secret)),
  cancel: (id: string, secret: string) => call<PublicBounty>("POST", `/bounties/${id}/cancel`, undefined, poster(secret)),
  retryPayout: (id: string, secret: string) => call<PublicBounty>("POST", `/bounties/${id}/retry-payout`, undefined, poster(secret)),
};

// Server-sent events. Pass "/events" for the board or "/bounties/:id/events" for one bounty.
export function subscribe(path: string, onStatus: (change: StatusChange) => void): () => void {
  const source = new EventSource(BASE + path);
  source.addEventListener("status", (e) => onStatus(JSON.parse((e as MessageEvent).data) as StatusChange));
  return () => source.close();
}

// The poster secret is the only auth. It lives in this browser's localStorage.
export const secrets = {
  get: (bountyId: string) => localStorage.getItem(`boltbounty:secret:${bountyId}`),
  set: (bountyId: string, secret: string) => localStorage.setItem(`boltbounty:secret:${bountyId}`, secret),
};
