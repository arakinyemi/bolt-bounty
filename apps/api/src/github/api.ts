import type { GithubIssue, GithubPull, GithubRepo } from "@boltbounty/shared";

// Thin GitHub REST client. Every call uses the signed-in user's OAuth token, so
// the platform never needs its own GitHub credentials beyond the OAuth app.

const API = "https://api.github.com";

export class GithubError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "GithubError";
  }
}

async function gh<T>(token: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(API + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "boltbounty",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new GithubError(`GitHub ${path} responded ${res.status}`, res.status);
  return (await res.json()) as T;
}

// Issue numbers referenced like "#12", "closes #12" or "fixes #12".
export function linkedIssues(text: string): number[] {
  return [...new Set([...text.matchAll(/(?:^|[^\w/])#(\d+)\b/g)].map((m) => Number(m[1])))];
}

export interface GithubUser {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
}

interface RawRepo {
  full_name: string;
  name: string;
  owner: { login: string };
  html_url: string;
  description: string | null;
  private: boolean;
  updated_at: string;
}

interface RawPull {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  user: { login: string };
  draft: boolean;
  updated_at: string;
}

interface RawIssue {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  user: { login: string };
  labels: { name: string }[];
  updated_at: string;
  pull_request?: unknown; // present when the "issue" is actually a PR
}

const toRepo = (r: RawRepo): GithubRepo => ({
  fullName: r.full_name,
  name: r.name,
  owner: r.owner.login,
  url: r.html_url,
  description: r.description,
  private: r.private,
  updatedAt: r.updated_at,
});

const toPull = (me: string) => (p: RawPull): GithubPull => ({
  number: p.number,
  title: p.title,
  url: p.html_url,
  author: p.user.login,
  draft: p.draft,
  updatedAt: p.updated_at,
  mine: p.user.login === me,
  linkedIssues: linkedIssues(`${p.title}\n${p.body ?? ""}`),
});

const toIssue = (i: RawIssue): GithubIssue => ({
  number: i.number,
  title: i.title,
  url: i.html_url,
  body: (i.body ?? "").trim().slice(0, 600),
  author: i.user.login,
  labels: i.labels.map((l) => l.name),
  updatedAt: i.updated_at,
});

export const github = {
  user: (token: string) => gh<GithubUser>(token, "/user"),

  repos: async (token: string): Promise<GithubRepo[]> => {
    const raw = await gh<RawRepo[]>(token, "/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator,organization_member");
    return raw.map(toRepo);
  },

  pulls: async (token: string, fullName: string, me: string): Promise<GithubPull[]> => {
    const raw = await gh<RawPull[]>(token, `/repos/${fullName}/pulls?state=open&sort=updated&direction=desc&per_page=50`);
    return raw.map(toPull(me));
  },

  pull: async (token: string, fullName: string, number: number, me: string): Promise<GithubPull> => {
    return toPull(me)(await gh<RawPull>(token, `/repos/${fullName}/pulls/${number}`));
  },

  // The issues endpoint also returns pull requests; those are filtered out.
  issues: async (token: string, fullName: string): Promise<GithubIssue[]> => {
    const raw = await gh<RawIssue[]>(token, `/repos/${fullName}/issues?state=open&sort=updated&direction=desc&per_page=50`);
    return raw.filter((i) => !i.pull_request).map(toIssue);
  },

  issue: async (token: string, fullName: string, number: number): Promise<GithubIssue> => {
    const raw = await gh<RawIssue>(token, `/repos/${fullName}/issues/${number}`);
    if (raw.pull_request) throw new GithubError(`#${number} on ${fullName} is a pull request, not an issue`, 400);
    return toIssue(raw);
  },

  comment: async (token: string, fullName: string, issueNumber: number, body: string): Promise<void> => {
    await gh(token, `/repos/${fullName}/issues/${issueNumber}/comments`, { body });
  },
};
