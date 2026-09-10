import { createHash, randomBytes } from "node:crypto";

// A hold invoice is locked to sha256(preimage). The API keeps the preimage
// secret until the poster approves; revealing it to LND settles the escrow.

export function hashOf(preimageHex: string): string {
  return createHash("sha256").update(Buffer.from(preimageHex, "hex")).digest("hex");
}

export function newPreimage(): { preimage: string; hash: string } {
  const preimage = randomBytes(32).toString("hex");
  return { preimage, hash: hashOf(preimage) };
}
