import {Inject, Injectable} from "@nestjs/common";
import {
  BaseCollection,
  DatabaseService,
  Filter,
  FindOneAndDeleteOptions,
  FindOneAndReplaceOptions,
  FindOneAndUpdateOptions,
  OptionalUnlessRequiredId,
  UpdateFilter,
  WithId
} from "@spica-server/database";
import {Secret} from "@spica-server/interface-secret";
import {CollectionChangeEvent} from "@spica-server/replication";
import {Observable} from "rxjs";
import {SecretChangeDispatcher} from "./change-dispatcher.js";

export const SECRET_ENCRYPTION_SECRET = Symbol.for("SECRET_ENCRYPTION_SECRET");

@Injectable()
export class SecretService extends BaseCollection<Secret>("secret") {
  constructor(
    db: DatabaseService,
    @Inject(SECRET_ENCRYPTION_SECRET) public readonly encryptionSecret: string,
    private readonly changeDispatcher: SecretChangeDispatcher
  ) {
    super(db, {
      afterInit: () => this._coll.createIndex({key: 1}, {unique: true}),
      collectionOptions: {changeStreamPreAndPostImages: {enabled: true}}
    });
  }

  async insertOne(doc: OptionalUnlessRequiredId<Secret>): Promise<WithId<Secret>> {
    const result = await super.insertOne(doc);
    this.changeDispatcher.dispatch({operationType: "insert", documentKey: {_id: result._id}});
    return result;
  }

  async findOneAndUpdate(
    filter: Filter<Secret>,
    update: UpdateFilter<Secret> | Secret,
    options?: FindOneAndUpdateOptions
  ): Promise<WithId<Secret>> {
    const result = await super.findOneAndUpdate(filter, update, options);
    if (result) {
      this.changeDispatcher.dispatch({operationType: "update", documentKey: {_id: result._id}});
    }
    return result;
  }

  async findOneAndReplace(
    filter: Filter<Secret>,
    doc: Secret,
    options?: FindOneAndReplaceOptions
  ): Promise<WithId<Secret>> {
    const result = await super.findOneAndReplace(filter, doc, options);
    if (result) {
      this.changeDispatcher.dispatch({operationType: "replace", documentKey: {_id: result._id}});
    }
    return result;
  }

  async findOneAndDelete(
    filter: Filter<Secret>,
    options?: FindOneAndDeleteOptions
  ): Promise<WithId<Secret>> {
    const result = await super.findOneAndDelete(filter, options);
    if (result) {
      this.changeDispatcher.dispatch({operationType: "delete", documentKey: {_id: result._id}});
    }
    return result;
  }

  watchChanges(): Observable<CollectionChangeEvent> {
    return this.changeDispatcher.watch();
  }
}
