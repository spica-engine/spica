import * as crypto from "node:crypto";

export function deriveKeyBuffer(ikm: string, info: string = ""): Buffer {
  return Buffer.from(
    crypto.hkdfSync(
      "sha256",
      Buffer.from(ikm, "utf8"),
      Buffer.alloc(0),
      Buffer.from(info, "utf8"),
      32
    )
  );
}

export function deriveKey(ikm: string, info: string = ""): string {
  return deriveKeyBuffer(ikm, info).toString("hex");
}
