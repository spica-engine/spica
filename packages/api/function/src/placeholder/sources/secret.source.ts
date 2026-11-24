import {Inject, Injectable} from "@nestjs/common";
import {SECRET_DECRYPTOR, SecretDecryptor} from "@spica-server/interface-secret";
import {PlaceholderSource, RuntimeFunction} from "../placeholder-source.js";

@Injectable()
export class SecretSource implements PlaceholderSource {
  readonly prefix = "SECRET";

  constructor(@Inject(SECRET_DECRYPTOR) private decrypt: SecretDecryptor) {}

  load(fn: RuntimeFunction): Map<string, string> {
    const decrypted = (fn.secrets ?? []).map(secret => this.decrypt(secret));
    return new Map(decrypted.map(secret => [secret.key, secret.value]));
  }
}
