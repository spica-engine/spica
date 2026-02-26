import {ObjectId} from "@spica-server/database";
import {EncryptedData} from "@spica-server/core/encryption";

export interface Secret {
  _id: ObjectId;
  key: string;
  value: EncryptedData<false>;
}

export interface DecryptedSecret {
  _id: ObjectId;
  key: string;
  value: string;
}

export interface HiddenSecret {
  _id: ObjectId;
  key: string;
}

export const SECRET_DECRYPTOR = Symbol.for("SECRET_DECRYPTOR");

export interface SecretDecryptor {
  decrypt(secret: Secret): DecryptedSecret;
  hideValue(secret: Secret): HiddenSecret;
}
