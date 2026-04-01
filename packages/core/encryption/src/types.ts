export type BaseEncryptedData = {
  encrypted: string;
  iv: string;
  authTag: string;
};

export type EncryptedData<Queryable extends boolean = true> = Queryable extends true
  ? BaseEncryptedData & {hash: string}
  : BaseEncryptedData;

export function isEncryptedData(value: unknown): value is BaseEncryptedData {
  return (
    typeof value === "object" &&
    value !== null &&
    "encrypted" in value &&
    "iv" in value &&
    "authTag" in value
  );
}
