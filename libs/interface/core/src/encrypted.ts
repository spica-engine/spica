export interface EncryptedData {
  encrypted: string;
  iv: string;
  authTag: string;
  salt: string;
}
