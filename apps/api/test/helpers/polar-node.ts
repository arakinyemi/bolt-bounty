import fs from "node:fs";
import { Agent, fetch } from "undici";

// Minimal client for the poster and worker nodes, used only by the live tests
// to play the roles a human plays in Polar during the demo.
export class PolarNode {
  private dispatcher: Agent;
  private headers: Record<string, string>;

  constructor(readonly host: string, certPath: string, macaroonPath: string) {
    this.dispatcher = new Agent({ connect: { ca: fs.readFileSync(certPath) } });
    this.headers = { "Grpc-Metadata-macaroon": fs.readFileSync(macaroonPath).toString("hex") };
  }

  static fromEnv(role: "POSTER" | "WORKER"): PolarNode {
    const get = (k: string) => {
      const v = process.env[`TEST_${role}_${k}`];
      if (!v) throw new Error(`TEST_${role}_${k} is not set in .env`);
      return v;
    };
    return new PolarNode(get("REST_HOST"), get("TLS_CERT_PATH"), get("MACAROON_PATH"));
  }

  private async call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const res = await fetch(this.host + path, {
      method,
      headers: this.headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      dispatcher: this.dispatcher,
    });
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${await res.text()}`);
    return (await res.json()) as T;
  }

  async channelLocalSats(): Promise<number> {
    const r = await this.call<{ local_balance: { sat: string } }>("GET", "/v1/balance/channels");
    return Number(r.local_balance.sat);
  }

  async createInvoice(sats: number, memo = "test payout"): Promise<string> {
    const r = await this.call<{ payment_request: string }>("POST", "/v1/invoices", {
      value: String(sats),
      memo,
      expiry: "3600",
    });
    return r.payment_request;
  }

  // Starts paying and resolves `inFlight` once the HTLC is out; `final`
  // resolves with SUCCEEDED or FAILED when the payment settles either way.
  pay(bolt11: string): { inFlight: Promise<void>; final: Promise<string> } {
    let markInFlight!: () => void;
    const inFlight = new Promise<void>((resolve) => (markInFlight = resolve));
    const final = (async () => {
      const res = await fetch(this.host + "/v2/router/send", {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({ payment_request: bolt11, fee_limit_sat: "50", timeout_seconds: 60 }),
        dispatcher: this.dispatcher,
      });
      if (!res.ok || !res.body) throw new Error(`router/send -> ${res.status}: ${await res.text()}`);
      const decoder = new TextDecoder();
      let buffer = "";
      for await (const chunk of res.body) {
        buffer += decoder.decode(chunk, { stream: true });
        let nl;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          const msg = JSON.parse(line) as { result?: { status: string; failure_reason: string }; error?: { message: string } };
          if (msg.error) throw new Error(msg.error.message);
          const status = msg.result?.status;
          if (status === "IN_FLIGHT") markInFlight();
          if (status === "SUCCEEDED" || status === "FAILED") return status;
        }
      }
      throw new Error("payment stream ended without a final status");
    })();
    final.catch(() => {});
    return { inFlight, final };
  }
}

export async function waitFor<T>(label: string, fn: () => Promise<T>, ok: (v: T) => boolean, timeoutMs = 30_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last: T;
  do {
    last = await fn();
    if (ok(last)) return last;
    await new Promise((r) => setTimeout(r, 500));
  } while (Date.now() < deadline);
  throw new Error(`timed out waiting for ${label}; last value: ${JSON.stringify(last)}`);
}
