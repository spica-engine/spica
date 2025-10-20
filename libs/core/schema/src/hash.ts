import * as crypto from "crypto";

export function hash(value: string, secret: string): string {
  if (!secret) {
    throw new Error("Hash secret is required.");
  }

  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}
