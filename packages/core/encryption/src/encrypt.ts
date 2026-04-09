import * as crypto from "node:crypto";
import {BaseEncryptedData, EncryptedData} from "./types.js";
import {hash} from "./hash.js";
import {deriveKeyBuffer} from "./derive.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

export function encrypt(
  value: string,
  encryptionSecret: string,
  hashSecret: string
): EncryptedData<true>;
export function encrypt(value: string, encryptionSecret: string): EncryptedData<false>;
export function encrypt(
  value: string,
  encryptionSecret: string,
  hashSecret?: string
): EncryptedData<boolean> {
  if (!value) {
    throw new Error("Value to encrypt is required.");
  }

  if (!encryptionSecret) {
    throw new Error("Encryption secret is required.");
  }
  const key = deriveKeyBuffer(encryptionSecret);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(value, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  const base: BaseEncryptedData = {
    encrypted,
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex")
  };

  if (hashSecret) {
    return {...base, hash: hash(value, hashSecret)} as EncryptedData<true>;
  }

  return base;
}
