import * as crypto from "node:crypto";
import {BadRequestException} from "@nestjs/common";
import {BaseEncryptedData} from "./types";

const ALGORITHM = "aes-256-gcm";

export function decrypt(encryptedData: BaseEncryptedData, secret: string): string {
  if (!encryptedData) {
    throw new BadRequestException("Encrypted data is required.");
  }
  if (!secret) {
    throw new BadRequestException("Decryption secret is required.");
  }

  const {encrypted, iv, authTag} = encryptedData;

  if (!encrypted || !iv || !authTag) {
    throw new BadRequestException("Invalid encrypted data format.");
  }

  const key = deriveKey(secret);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, "hex"));

  decipher.setAuthTag(Buffer.from(authTag, "hex"));

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

function deriveKey(secret: string): Buffer {
  return crypto
    .createHash("sha256")
    .update(secret, "utf8")
    .digest();
}
