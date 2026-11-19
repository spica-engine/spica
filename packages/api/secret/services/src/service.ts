import {Inject, Injectable} from "@nestjs/common";
import {Secret, SECRET_REPOSITORY, SecretRepository} from "@spica-server/interface-secret";
import {Observable} from "rxjs";
import {SecretChangeDispatcher, SecretChangeEvent} from "./change-dispatcher.js";
import {Id} from "@spica-server/interface-data";
import {decrypt} from "@spica-server/core-encryption";
import {idOf, withId} from "@spica-server/data";

export const SECRET_ENCRYPTION_SECRET = Symbol.for("SECRET_ENCRYPTION_SECRET");

@Injectable()
export class SecretService {
  constructor(
    @Inject(SECRET_REPOSITORY) private readonly secrets: SecretRepository,
    @Inject(SECRET_ENCRYPTION_SECRET) public readonly encryptionSecret: string,
    private readonly changeDispatcher: SecretChangeDispatcher
  ) {}

  findById(id: Id): Promise<Secret | null> {
    return this.secrets.findById(id);
  }

  async insert(secret: Secret): Promise<Secret> {
    const result = await this.secrets.insert(secret);
    this.dispatchChange("insert", idOf(result), [secret]);
    return result;
  }

  async replaceById(id: Id, secret: Secret): Promise<Secret | null> {
    const previous = await this.secrets.replaceById(id, secret);
    if (!previous) {
      return previous;
    }
    const current = withId({...secret}, idOf(previous));
    this.dispatchIfConsumersAffected("replace", idOf(previous), previous, current);
    return current;
  }

  async updateById(id: Id, fields: Partial<Secret>): Promise<Secret | null> {
    const previous = await this.secrets.updateById(id, fields);
    if (!previous) {
      return previous;
    }
    const current = await this.secrets.findById(idOf(previous));
    this.dispatchIfConsumersAffected("update", idOf(previous), previous, current);
    return current;
  }

  async deleteById(id: Id): Promise<Secret | null> {
    const result = await this.secrets.deleteById(id);
    if (result) {
      this.dispatchChange("delete", idOf(result), [result]);
    }
    return result;
  }

  watchChanges(): Observable<SecretChangeEvent> {
    return this.changeDispatcher.watch();
  }

  private dispatchIfConsumersAffected(
    operationType: "update" | "replace",
    id: Id,
    previous: Secret,
    current: Secret | null
  ) {
    if (current && !this.affectsConsumers(previous, current)) {
      return;
    }
    this.dispatchChange(operationType, id, [previous, current]);
  }

  private affectsConsumers(previous: Secret, current: Secret): boolean {
    return previous.key !== current.key || !this.hasSameValue(previous, current);
  }

  private hasSameValue(previous: Secret, current: Secret): boolean {
    try {
      return (
        decrypt(previous.value, this.encryptionSecret) ===
        decrypt(current.value, this.encryptionSecret)
      );
    } catch {
      // An undecryptable value must still propagate, otherwise replacing a broken secret would never reach its consumers.
      return false;
    }
  }

  private dispatchChange(
    operationType: SecretChangeEvent["operationType"],
    id: Id,
    secrets: Pick<Secret, "key">[]
  ) {
    const keys = Array.from(new Set(secrets.filter(Boolean).map(secret => secret.key)));
    this.changeDispatcher.dispatch({operationType, documentKey: withId({}, id), keys});
  }
}
