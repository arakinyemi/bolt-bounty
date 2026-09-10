import { hashOf } from "./preimage.js";
import { LndError, lndGet, lndPost, lndPostStream, logLnd } from "./rest.js";

// The seven LND calls the product needs, all against the platform node.
// Hashes and preimages are hex strings at this boundary; LND's REST API wants
// padded base64 in JSON bodies and in query strings (percent-encoded there).

const b64 = (hex: string) => Buffer.from(hex, "hex").toString("base64");
const b64query = (hex: string) => encodeURIComponent(b64(hex));

export interface NodeInfo {
  alias: string;
  identity_pubkey: string;
  version: string;
  block_height: number;
  synced_to_chain: boolean;
  num_active_channels: number;
  num_pending_channels: number;
  chains: { chain: string; network: string }[];
}

export type InvoiceState = "OPEN" | "ACCEPTED" | "SETTLED" | "CANCELED";

export interface Invoice {
  state: InvoiceState;
  memo: string;
  value: string;
  amt_paid_sat: string;
  payment_request: string;
  creation_date: string;
  expiry: string;
  htlcs: { expiry_height: number; amt_msat: string; state: string }[];
}

export interface DecodedInvoice {
  paymentHash: string;
  destination: string;
  amountSats: number;
  description: string;
  expiresAt: string;
}

export interface PaymentResult {
  paymentHash: string;
  preimage: string;
  feeSats: number;
}

interface Payment {
  status: "UNKNOWN" | "IN_FLIGHT" | "SUCCEEDED" | "FAILED";
  failure_reason: string;
  payment_hash: string;
  payment_preimage: string;
  fee_sat: string;
}

export const lnd = {
  getInfo(): Promise<NodeInfo> {
    return lndGet<NodeInfo>("/v1/getinfo");
  },

  async addHoldInvoice(args: {
    hash: string;
    valueSats: number;
    memo: string;
    expirySeconds: number;
    cltvExpiry: number;
  }): Promise<string> {
    const res = await lndPost<{ payment_request: string }>(
      "/v2/invoices/hodl",
      {
        hash: b64(args.hash),
        value: String(args.valueSats),
        memo: args.memo,
        expiry: String(args.expirySeconds),
        cltv_expiry: String(args.cltvExpiry),
      },
      args.hash,
    );
    return res.payment_request;
  },

  lookupInvoice(hash: string): Promise<Invoice> {
    return lndGet<Invoice>(`/v2/invoices/lookup?payment_hash=${b64query(hash)}`, hash);
  },

  async settleInvoice(preimage: string): Promise<void> {
    await lndPost("/v2/invoices/settle", { preimage: b64(preimage) }, hashOf(preimage));
  },

  async cancelInvoice(hash: string): Promise<void> {
    await lndPost("/v2/invoices/cancel", { payment_hash: b64(hash) }, hash);
  },

  async decodeInvoice(bolt11: string): Promise<DecodedInvoice> {
    const r = await lndGet<{
      payment_hash: string;
      destination: string;
      num_satoshis: string;
      description: string;
      timestamp: string;
      expiry: string;
    }>(`/v1/payreq/${bolt11}`);
    return {
      paymentHash: r.payment_hash,
      destination: r.destination,
      amountSats: Number(r.num_satoshis),
      description: r.description,
      expiresAt: new Date((Number(r.timestamp) + Number(r.expiry)) * 1000).toISOString(),
    };
  },

  // Streams payment updates and resolves on the first SUCCEEDED, rejects on
  // the first FAILED. The decode is only so the log line carries the hash.
  async payInvoice(bolt11: string, feeLimitSats: number): Promise<PaymentResult> {
    const { paymentHash } = await lnd.decodeInvoice(bolt11);
    const updates = lndPostStream<{ result?: Payment; error?: { message: string } }>(
      "/v2/router/send",
      { payment_request: bolt11, fee_limit_sat: String(feeLimitSats), timeout_seconds: 60 },
      paymentHash,
    );
    for await (const update of updates) {
      if (update.error) {
        logLnd("router/send", paymentHash, `error ${update.error.message}`);
        throw new LndError(`payment failed: ${update.error.message}`);
      }
      const p = update.result;
      if (!p) continue;
      if (p.status === "SUCCEEDED") {
        logLnd("router/send", paymentHash, "SUCCEEDED");
        return { paymentHash: p.payment_hash, preimage: p.payment_preimage, feeSats: Number(p.fee_sat) };
      }
      if (p.status === "FAILED") {
        logLnd("router/send", paymentHash, `FAILED ${p.failure_reason}`);
        throw new LndError(`payment failed: ${p.failure_reason}`);
      }
    }
    throw new LndError("payment stream ended without a final status");
  },
};
