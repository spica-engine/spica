import * as crypto from "crypto";
import {EncryptedData} from "@spica-server/interface/core";
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const KEY_LENGTH = 32;

/**
 * Encrypts a value using AES-256-GCM
 * @param value - The plaintext value to encrypt
 * @param secret - The secret key used for encryption
 * @returns Encrypted data object containing encrypted value, IV, auth tag, and salt
 */
export function encrypt(value: string, secret: string): EncryptedData {
  if (!value) {
    throw new Error("Value to encrypt is required.");
  }
  if (!secret) {
    throw new Error("Encryption secret is required.");
  }

  const salt = crypto.randomBytes(SALT_LENGTH);

  const key = crypto.scryptSync(secret, salt, KEY_LENGTH);

  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(value, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
    salt: salt.toString("hex")
  };
}

/**
 * Decrypts an encrypted value using AES-256-GCM
 * @param encryptedData - The encrypted data object
 * @param secret - The secret key used for decryption
 * @returns The decrypted plaintext value
 */
export function decrypt(encryptedData: EncryptedData, secret: string): string {
  if (!encryptedData) {
    throw new Error("Encrypted data is required.");
  }
  if (!secret) {
    throw new Error("Decryption secret is required.");
  }

  const {encrypted, iv, authTag, salt} = encryptedData;

  if (!encrypted || !iv || !authTag || !salt) {
    throw new Error("Invalid encrypted data format.");
  }

  const saltBuffer = Buffer.from(salt, "hex");
  const key = crypto.scryptSync(secret, saltBuffer, KEY_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, "hex"));

  decipher.setAuthTag(Buffer.from(authTag, "hex"));

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
