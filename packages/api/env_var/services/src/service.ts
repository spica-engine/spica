import {Injectable} from "@nestjs/common";
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
import {EnvVar} from "@spica-server/interface-env_var";
import {CollectionChangeEvent} from "@spica-server/replication";
import {Observable} from "rxjs";
import {EnvVarChangeDispatcher} from "./change-dispatcher.js";

@Injectable()
export class EnvVarService extends BaseCollection<EnvVar>("env_var") {
  constructor(
    db: DatabaseService,
    private readonly changeDispatcher: EnvVarChangeDispatcher
  ) {
    super(db, {
      afterInit: () => this._coll.createIndex({key: 1}, {unique: true}),
      collectionOptions: {changeStreamPreAndPostImages: {enabled: true}}
    });
  }

  async insertOne(doc: OptionalUnlessRequiredId<EnvVar>): Promise<WithId<EnvVar>> {
    const result = await super.insertOne(doc);
    this.changeDispatcher.dispatch({operationType: "insert", documentKey: {_id: result._id}});
    return result;
  }

  async findOneAndUpdate(
    filter: Filter<EnvVar>,
    update: UpdateFilter<EnvVar> | EnvVar,
    options?: FindOneAndUpdateOptions
  ): Promise<WithId<EnvVar>> {
    const result = await super.findOneAndUpdate(filter, update, options);
    if (result) {
      this.changeDispatcher.dispatch({operationType: "update", documentKey: {_id: result._id}});
    }
    return result;
  }

  async findOneAndReplace(
    filter: Filter<EnvVar>,
    doc: EnvVar,
    options?: FindOneAndReplaceOptions
  ): Promise<WithId<EnvVar>> {
    const result = await super.findOneAndReplace(filter, doc, options);
    if (result) {
      this.changeDispatcher.dispatch({operationType: "replace", documentKey: {_id: result._id}});
    }
    return result;
  }

  async findOneAndDelete(
    filter: Filter<EnvVar>,
    options?: FindOneAndDeleteOptions
  ): Promise<WithId<EnvVar>> {
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
