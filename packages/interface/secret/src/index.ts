import {ObjectId} from "@spica-server/database";
import {EncryptedData} from "@spica-server/core/encryption";

export interface Secret {
  _id?: ObjectId;
  key: string;
  value: EncryptedData<false>;
}

export type DecryptedSecret = Omit<Secret, "value"> & {value: string};

export type HiddenSecret = Omit<Secret, "value">;

export const SECRET_DECRYPTOR = Symbol.for("SECRET_DECRYPTOR");

export type SecretDecryptor = (secret: Secret) => DecryptedSecret;
