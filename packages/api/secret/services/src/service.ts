import {Inject, Injectable} from "@nestjs/common";
import {Secret, SECRET_REPOSITORY, SecretRepository} from "@spica-server/interface-secret";
import {Observable} from "rxjs";
import {SecretChangeDispatcher, SecretChangeEvent} from "./change-dispatcher.js";
import {Id} from "@spica-server/interface-data";

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
    this.dispatchChange("insert", result._id, [secret]);
    return result;
  }

  async replaceById(id: Id, secret: Secret): Promise<Secret | null> {
    const previous = await this.secrets.replaceById(id, secret);
    if (!previous) {
      return previous;
    }
    const current = {...secret, _id: previous._id};
    this.dispatchChange("replace", previous._id, [previous, current]);
    return current;
  }

  async updateById(id: Id, fields: Partial<Secret>): Promise<Secret | null> {
    const previous = await this.secrets.updateById(id, fields);
    if (!previous) {
      return previous;
    }
    const current = await this.secrets.findById(previous._id);
    this.dispatchChange("update", previous._id, [previous, current]);
    return current;
  }

  async deleteById(id: Id): Promise<Secret | null> {
    const result = await this.secrets.deleteById(id);
    if (result) {
      this.dispatchChange("delete", result._id, [result]);
    }
    return result;
  }

  watchChanges(): Observable<SecretChangeEvent> {
    return this.changeDispatcher.watch();
  }

  private dispatchChange(
    operationType: SecretChangeEvent["operationType"],
    _id: Id,
    secrets: Pick<Secret, "key">[]
  ) {
    const keys = Array.from(new Set(secrets.filter(Boolean).map(secret => secret.key)));
    this.changeDispatcher.dispatch({operationType, documentKey: {_id}, keys});
  }
}
