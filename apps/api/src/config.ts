import fs from "node:fs";
import path from "node:path";

// Relative paths in .env are resolved against the repo root, not apps/api.
const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}. Copy .env.example to .env and fill it in (see docs/polar.md).`);
  }
  return value;
}

function fromRoot(p: string): string {
  return path.isAbsolute(p) ? p : path.resolve(REPO_ROOT, p);
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  databasePath: fromRoot(process.env.DATABASE_PATH ?? "./data/boltbounty.db"),
  bountyDefaultExpirySeconds: Number(process.env.BOUNTY_DEFAULT_EXPIRY_SECONDS ?? 86400),
  holdInvoiceCltvExpiry: Number(process.env.HOLD_INVOICE_CLTV_EXPIRY ?? 400),
  lnd: {
    restHost: required("LND_REST_HOST").replace(/\/$/, ""),
    macaroonHex: required("LND_MACAROON_HEX"),
    tlsCert: fs.readFileSync(fromRoot(required("LND_TLS_CERT_PATH"))),
  },
};
