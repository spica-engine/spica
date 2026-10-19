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

    let secretsByFunction: Map<string, Map<string, string> | Error>;
    try {
      secretsByFunction = await this.findDecryptedSecrets(Array.from(functionIds));
    } catch (error) {
      this.logger.error(
        `Failed to look up secrets of functions ${Array.from(functionIds).join(", ")}. Reason: ${describe(error)}`
      );
      return routing.filter(change => !isSubscribingWithSecretPlaceholder(change));
    }

    return routing.flatMap(change => {
      if (!isSubscribingWithSecretPlaceholder(change)) {
        return [change];
      }
      const secrets = secretsByFunction.get(change.target.id);
      if (secrets instanceof Error) {
        this.logger.error(
          `Skipping ${change.type} trigger '${change.target.handler}' of function ${change.target.id}, its secrets could not be resolved. Reason: ${secrets.message}`
        );
        return [];
      }
      return [
        secrets ? {...change, options: resolveSecretPlaceholders(change.options, secrets)} : change
      ];
    });
  }

  private async findDecryptedSecrets(
    functionIds: string[]
  ): Promise<Map<string, Map<string, string> | Error>> {
    const ids = functionIds.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id));
    const fns = await CRUD.findWithSecrets(this.fs, ids);

    return new Map<string, Map<string, string> | Error>(
      fns.map(fn => {
        try {
          const decrypted = (fn.secrets || []).map(secret => this.secretDecryptor(secret));
          return [
            fn._id.toString(),
            new Map(decrypted.map(secret => [secret.key, secret.value] as [string, string]))
          ];
        } catch (error) {
          return [fn._id.toString(), error instanceof Error ? error : new Error(String(error))];
        }
      })
    );
  }
}

function describe(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isSubscribingWithSecretPlaceholder(change: TargetChange) {
  return change.kind != ChangeKind.Removed && extractSecretKeys(change.options).length > 0;
}
