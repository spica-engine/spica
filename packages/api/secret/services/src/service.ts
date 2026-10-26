import {Inject, Injectable} from "@nestjs/common";
import {
  BaseCollection,
  DatabaseService,
  Filter,
  FindOneAndDeleteOptions,
  FindOneAndReplaceOptions,
  FindOneAndUpdateOptions,
  OptionalUnlessRequiredId,
  ReturnDocument,
  UpdateFilter,
  WithId
} from "@spica-server/database";
import {Secret} from "@spica-server/interface-secret";
import {Observable} from "rxjs";
import {SecretChangeDispatcher, SecretChangeEvent} from "./change-dispatcher.js";
import {Id} from "@spica-server/interface-data";

export const SECRET_ENCRYPTION_SECRET = Symbol.for("SECRET_ENCRYPTION_SECRET");

@Injectable()
export class SecretService extends BaseCollection<Secret>("secret") {
  constructor(
    db: DatabaseService,
    @Inject(SECRET_ENCRYPTION_SECRET) public readonly encryptionSecret: string,
    private readonly changeDispatcher: SecretChangeDispatcher
  ) {
    super(db, {
      afterInit: () => this._coll.createIndex({key: 1}, {unique: true})
    });
  }

  async insertOne(doc: OptionalUnlessRequiredId<Secret>): Promise<WithId<Secret>> {
    const result = await super.insertOne(doc);
    this.dispatchChange("insert", result._id, [doc]);
    return result;
  }

  async findOneAndUpdate(
    filter: Filter<Secret>,
    update: UpdateFilter<Secret> | Secret,
    options?: FindOneAndUpdateOptions
  ): Promise<WithId<Secret>> {
    const previous = await super.findOneAndUpdate(filter, update, {
      ...options,
      returnDocument: ReturnDocument.BEFORE
    });
    if (!previous) {
      return previous;
    }
    const current = await this.findOne({_id: previous._id});
    this.dispatchChange("update", previous._id, [previous, current]);
    return options?.returnDocument == ReturnDocument.AFTER ? current : previous;
  }

  async findOneAndReplace(
    filter: Filter<Secret>,
    doc: Secret,
    options?: FindOneAndReplaceOptions
  ): Promise<WithId<Secret>> {
    const previous = await super.findOneAndReplace(filter, doc, {
      ...options,
      returnDocument: ReturnDocument.BEFORE
    });
    if (!previous) {
      return previous;
    }
    const current = {...doc, _id: previous._id};
    this.dispatchChange("replace", previous._id, [previous, current]);
    return options?.returnDocument == ReturnDocument.AFTER ? current : previous;
  }

  async findOneAndDelete(
    filter: Filter<Secret>,
    options?: FindOneAndDeleteOptions
  ): Promise<WithId<Secret>> {
    const result = await super.findOneAndDelete(filter, options);
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
