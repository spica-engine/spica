import * as crypto from "node:crypto";

export function deriveKeyBuffer(input: string): Buffer {
  return crypto.createHash("sha256").update(input, "utf8").digest();
}

export function deriveKey(input: string): string {
  return deriveKeyBuffer(input).toString("hex");
}
