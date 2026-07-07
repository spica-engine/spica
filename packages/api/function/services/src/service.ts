import {Inject, Injectable, Optional} from "@nestjs/common";
import {
  BaseCollection,
  CreateIndexesOptions,
  DatabaseService,
  FindOneAndUpdateOptions,
  FindOptions,
  IndexSpecification,
  ObjectId,
  WithId
} from "@spica-server/database";
import {EnvVarService} from "@spica-server/env_var-services";
import {SecretService} from "@spica-server/secret-services";
import {CollectionChangeEvent} from "@spica-server/replication";
import {filter, map, Observable, switchMap} from "rxjs";
import {Function, FunctionOptions, FUNCTION_OPTIONS} from "@spica-server/interface-function";

const collectionName = "function";

// An env-var/secret insert has no functions referencing it yet, so only these operations
// can affect an existing function's resolved environment.
const relevantOperations = ["update", "replace", "delete"];
const isRelevantOperation = (change: CollectionChangeEvent) =>
  relevantOperations.includes(change.operationType);

@Injectable()
export class FunctionService extends BaseCollection<Function>(collectionName) {
  constructor(
    database: DatabaseService,
    private evs: EnvVarService,
    private ss: SecretService,
    @Inject(FUNCTION_OPTIONS) options: FunctionOptions
  ) {
    super(database, {
      entryLimit: options.entryLimit,
      afterInit: () =>
        Promise.all([
          this.createIndex({env_vars: 1}),
          this.createIndex({secrets: 1}),
          this.createIndex({name: 1}, {unique: true})
        ])
    });
  }

  private watchFunctionsForResource(
    changes: Observable<CollectionChangeEvent>,
    resourceField: "env_vars" | "secrets"
  ): Observable<{
    fns: WithId<Function>[];
    resourceId: ObjectId;
    operationType: "replace" | "update" | "delete";
  }> {
    return changes.pipe(
      filter(isRelevantOperation),
      switchMap(change =>
        this.find({[resourceField]: {$in: [change.documentKey._id]}}).then(fns => ({
          fns,
          resourceId: change.documentKey._id,
          operationType: change.operationType as "replace" | "update" | "delete"
        }))
      )
    );
  }

  watchFunctionsForEnvChanges(): Observable<{
    fns: WithId<Function>[];
    envVarId: ObjectId;
    operationType: "replace" | "update" | "delete";
  }> {
    return this.watchFunctionsForResource(this.evs.watchChanges(), "env_vars").pipe(
      map(({fns, resourceId, operationType}) => ({fns, envVarId: resourceId, operationType}))
    );
  }

  watchFunctionsForSecretChanges(): Observable<{
    fns: WithId<Function>[];
    secretId: ObjectId;
    operationType: "replace" | "update" | "delete";
  }> {
    return this.watchFunctionsForResource(this.ss.watchChanges(), "secrets").pipe(
      map(({fns, resourceId, operationType}) => ({fns, secretId: resourceId, operationType}))
    );
  }
}
