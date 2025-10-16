import * as crypto from "crypto";

export function hashValue(value: string, secret: string): string {
  if (!secret) {
    throw new Error("Hashing secret is required for hashed field types");
  }

  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}
