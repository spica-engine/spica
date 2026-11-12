import {Inject, Injectable} from "@nestjs/common";
import {Secret, SECRET_REPOSITORY, SecretRepository} from "@spica-server/interface-secret";
import {Observable} from "rxjs";
import {SecretChangeDispatcher, SecretChangeEvent} from "./change-dispatcher.js";
import {Id} from "@spica-server/interface-data";
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
    this.dispatchChange("replace", idOf(previous), [previous, current]);
    return current;
  }

  async updateById(id: Id, fields: Partial<Secret>): Promise<Secret | null> {
    const previous = await this.secrets.updateById(id, fields);
    if (!previous) {
      return previous;
    }
    const current = await this.secrets.findById(idOf(previous));
    this.dispatchChange("update", idOf(previous), [previous, current]);
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

  private dispatchChange(
    operationType: SecretChangeEvent["operationType"],
    id: Id,
    secrets: Pick<Secret, "key">[]
  ) {
    const keys = Array.from(new Set(secrets.filter(Boolean).map(secret => secret.key)));
    this.changeDispatcher.dispatch({operationType, documentKey: withId({}, id), keys});
  }
}
