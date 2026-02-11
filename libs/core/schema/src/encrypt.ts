import * as crypto from "crypto";
import {EncryptedData} from "@spica-server/interface/passport/user";
import {BadRequestException} from "@nestjs/common";
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

/**
 * Encrypts a value using AES-256-GCM
 * @param value - The plaintext value to encrypt
 * @param secret - The secret key used for encryption
 * @returns Encrypted data object containing encrypted value, IV, auth tag, and salt
 */
export function encrypt(value: string, secret: string): EncryptedData {
  if (!value) {
    throw new BadRequestException("Value to encrypt is required.");
  }
  if (!secret) {
    throw new BadRequestException("Encryption secret is required.");
  }
  const secretBuffer = Buffer.from(secret, "utf-8");

  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, secretBuffer, iv);

  let encrypted = cipher.update(value, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex")
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
    throw new BadRequestException("Encrypted data is required.");
  }
  if (!secret) {
    throw new BadRequestException("Decryption secret is required.");
  }

  const {encrypted, iv, authTag} = encryptedData;

  if (!encrypted || !iv || !authTag) {
    throw new BadRequestException("Invalid encrypted data format.");
  }

  const secretBuffer = Buffer.from(secret, "utf-8");
  const decipher = crypto.createDecipheriv(ALGORITHM, secretBuffer, Buffer.from(iv, "hex"));

  decipher.setAuthTag(Buffer.from(authTag, "hex"));

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
