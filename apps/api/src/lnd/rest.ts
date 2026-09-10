import { Agent, fetch, type Response } from "undici";
import { config } from "../config.js";

// HTTP transport for the platform LND node's REST API. Every LND call in the
// app goes through here so each one is logged with method, hash prefix, and
// outcome. Regtest only: the TLS cert and macaroon come from Polar.

const dispatcher = new Agent({ connect: { ca: config.lnd.tlsCert } });
const headers = { "Grpc-Metadata-macaroon": config.lnd.macaroonHex };

export class LndError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "LndError";
  }
}

export function logLnd(method: string, hash: string | null, outcome: string): void {
  const prefix = hash ? hash.slice(0, 8) : "-";
  console.log(`[lnd] ${method} hash=${prefix} ${outcome}`);
}

export function lndGet<T>(path: string, hash: string | null = null): Promise<T> {
  return request<T>("GET", path, undefined, hash);
}

export function lndPost<T>(path: string, body: unknown, hash: string | null = null): Promise<T> {
  return request<T>("POST", path, body, hash);
}

async function request<T>(
  method: "GET" | "POST",
  path: string,
  body: unknown,
  hash: string | null,
): Promise<T> {
  const url = config.lnd.restHost + path;
  const label = `${method} ${path.split("?")[0]}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      dispatcher,
    });
  } catch (err) {
    logLnd(label, hash, "unreachable");
    const cause = err instanceof Error && err.cause ? ` (${String(err.cause)})` : "";
    throw new LndError(`LND unreachable at ${url}${cause}`);
  }
  const text = await res.text();
  if (!res.ok) {
    logLnd(label, hash, `http ${res.status}`);
    throw new LndError(`LND ${label} failed with HTTP ${res.status}: ${text}`, res.status);
  }
  logLnd(label, hash, "ok");
  return JSON.parse(text) as T;
}
