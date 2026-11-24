import {EncryptedData} from "@spica-server/core-encryption";
import {
  DeletableById,
  ReplaceableById,
  Repository,
  UpdatableById
} from "@spica-server/interface-data";

export interface Secret {
  key: string;
  value: EncryptedData<false>;
  salt?: string;
  value_hash?: string;
  updated_at?: Date;
}

export type DecryptedSecret = Omit<Secret, "value"> & {value: string};

export type HiddenSecret = Omit<Secret, "value">;

export const SECRET_DECRYPTOR = Symbol.for("SECRET_DECRYPTOR");

export type SecretDecryptor = (secret: Secret) => DecryptedSecret;

/**
 * `replaceById` and `updateById` resolve to the secret as it was before the write, or null when
 * there is none with the id.
 */
export interface SecretRepository
  extends
    Repository<Secret>,
    ReplaceableById<Secret>,
    UpdatableById<Secret>,
    DeletableById<Secret | null> {}

export const SECRET_REPOSITORY = Symbol.for("SECRET_REPOSITORY");
