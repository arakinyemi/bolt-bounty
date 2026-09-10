import { config } from "../config.js";

// GitHub OAuth web flow. The callback lands on the web origin and is proxied
// (dev) or served (prod) by this API under /api.

const SCOPES = "read:user public_repo";

export function callbackUrl(): string {
  return `${config.appUrl}/api/auth/github/callback`;
}

export function authorizeUrl(state: string): string {
  if (!config.github) throw new Error("GitHub sign-in is not configured");
  const params = new URLSearchParams({
    client_id: config.github.clientId,
    redirect_uri: callbackUrl(),
    scope: SCOPES,
    state,
  });
  return `https://github.com/login/oauth/authorize?${params}`;
}

export async function exchangeCode(code: string): Promise<string> {
  if (!config.github) throw new Error("GitHub sign-in is not configured");
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: config.github.clientId,
      client_secret: config.github.clientSecret,
      code,
      redirect_uri: callbackUrl(),
    }),
  });
  const data = (await res.json()) as { access_token?: string; error_description?: string };
  if (!data.access_token) throw new Error(`GitHub token exchange failed: ${data.error_description ?? "no token returned"}`);
  return data.access_token;
}
