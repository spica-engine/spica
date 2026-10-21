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
