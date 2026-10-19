import {Inject, Injectable, Logger} from "@nestjs/common";
import {ObjectId} from "@spica-server/database";
import {FunctionService} from "@spica-server/function-services";
import {ChangeKind, TargetChange} from "@spica-server/interface-function";
import {SECRET_DECRYPTOR, SecretDecryptor} from "@spica-server/interface-secret";
import * as CRUD from "./crud.js";
import {extractSecretKeys, resolveSecretPlaceholders} from "./secret-placeholder.js";

// Plans travel between replicas with placeholders only; secret values are resolved per replica,
// right before subscribing, so they never leave the replica's memory.
@Injectable()
export class TriggerSecretResolver {
  private readonly logger = new Logger(TriggerSecretResolver.name);

  constructor(
    private fs: FunctionService,
    @Inject(SECRET_DECRYPTOR) private secretDecryptor: SecretDecryptor
  ) {}

  async resolve(routing: TargetChange[]): Promise<TargetChange[]> {
    const functionIds = new Set(
      routing.filter(isSubscribingWithSecretPlaceholder).map(change => change.target.id)
    );
    if (!functionIds.size) {
      return routing;
    }

    let secretsByFunction: Map<string, Map<string, string>>;
    try {
      secretsByFunction = await this.findDecryptedSecrets(Array.from(functionIds));
    } catch (error) {
      this.logger.error(
        `Failed to look up secrets of functions ${Array.from(functionIds).join(", ")}, their placeholders stay unresolved. Reason: ${errorMessage(error)}`
      );
      return routing;
    }

    return routing.map(change => {
      const secrets = secretsByFunction.get(change.target.id);
      if (!secrets || !isSubscribingWithSecretPlaceholder(change)) {
        return change;
      }
      return {...change, options: resolveSecretPlaceholders(change.options, secrets)};
    });
  }

  private async findDecryptedSecrets(
    functionIds: string[]
  ): Promise<Map<string, Map<string, string>>> {
    const ids = functionIds.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id));
    const fns = await CRUD.findWithSecrets(this.fs, ids);

    return new Map(
      fns.map(fn => [
        fn._id.toString(),
        new Map(
          (fn.secrets || []).flatMap(secret => {
            try {
              const decrypted = this.secretDecryptor(secret);
              return [[decrypted.key, decrypted.value] as [string, string]];
            } catch (error) {
              this.logger.error(
                `Failed to decrypt secret '${secret.key}' of function ${fn._id}, its placeholders stay unresolved. Reason: ${errorMessage(error)}`
              );
              return [];
            }
          })
        )
      ])
    );
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isSubscribingWithSecretPlaceholder(change: TargetChange) {
  return change.kind != ChangeKind.Removed && extractSecretKeys(change.options).length > 0;
}
