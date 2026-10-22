import {EncryptedData} from "@spica-server/core-encryption";
import {Id} from "@spica-server/interface-data";

export interface Secret {
  _id?: Id;
  key: string;
  value: EncryptedData<false>;
  updated_at?: Date;
}

export type DecryptedSecret = Omit<Secret, "value"> & {value: string};

export type HiddenSecret = Omit<Secret, "value">;

export const SECRET_DECRYPTOR = Symbol.for("SECRET_DECRYPTOR");

export type SecretDecryptor = (secret: Secret) => DecryptedSecret;

export interface SecretRepository {
  findById(id: Id): Promise<Secret | null>;
  insert(secret: Secret): Promise<Secret>;
  /**
   * Resolves to the secret as it was before the replacement, or null when there is none with the id.
   */
  replaceById(id: Id, secret: Secret): Promise<Secret | null>;
  /**
   * Resolves to the secret as it was before the update, or null when there is none with the id.
   */
  updateById(id: Id, fields: Partial<Secret>): Promise<Secret | null>;
  deleteById(id: Id): Promise<Secret | null>;
}

export const SECRET_REPOSITORY = Symbol.for("SECRET_REPOSITORY");
