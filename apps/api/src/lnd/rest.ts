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

// For LND's server-streaming endpoints, which answer with one JSON object per
// line. Yields each parsed line; the caller decides when it has seen enough.
export async function* lndPostStream<T>(path: string, body: unknown, hash: string | null): AsyncGenerator<T> {
  const res = await send("POST", path, body, hash);
  if (!res.body) throw new LndError(`LND POST ${path} returned no body`);
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let newline;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) yield JSON.parse(line) as T;
    }
  }
  if (buffer.trim()) yield JSON.parse(buffer) as T;
}

async function request<T>(method: "GET" | "POST", path: string, body: unknown, hash: string | null): Promise<T> {
  const res = await send(method, path, body, hash);
  return (await res.json()) as T;
}

async function send(method: "GET" | "POST", path: string, body: unknown, hash: string | null): Promise<Response> {
  const url = config.lnd.restHost + path;
  const label = `${method} ${path.split("?")[0].slice(0, 40)}`;
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
  if (!res.ok) {
    const text = await res.text();
    logLnd(label, hash, `http ${res.status}`);
    throw new LndError(`LND ${label} failed with HTTP ${res.status}: ${text}`, res.status);
  }
  logLnd(label, hash, "ok");
  return res;
}
