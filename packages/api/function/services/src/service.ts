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

type ResourceOperationType = "replace" | "update" | "delete";

export interface EnvVarFunctionsChange {
  fns: WithId<Function>[];
  envVarId: ObjectId;
  operationType: ResourceOperationType;
}

export interface SecretFunctionsChange {
  fns: WithId<Function>[];
  secretId: ObjectId;
  secretKeys: string[];
  operationType: ResourceOperationType;
}

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

  private watchFunctionsForResource<E extends CollectionChangeEvent>(
    changes: Observable<E>,
    resourceField: "env_vars" | "secrets"
  ): Observable<{fns: WithId<Function>[]; change: E}> {
    return changes.pipe(
      filter(change => isRelevantOperation(change)),
      switchMap(change =>
        this.find({[resourceField]: {$in: [change.documentKey._id]}}).then(fns => ({fns, change}))
      )
    );
  }

  watchFunctionsForEnvChanges(): Observable<EnvVarFunctionsChange> {
    return this.watchFunctionsForResource(this.evs.watchChanges(), "env_vars").pipe(
      map(({fns, change}) => ({
        fns,
        envVarId: change.documentKey._id,
        operationType: change.operationType as ResourceOperationType
      }))
    );
  }

  watchFunctionsForSecretChanges(): Observable<SecretFunctionsChange> {
    return this.watchFunctionsForResource(this.ss.watchChanges(), "secrets").pipe(
      map(({fns, change}) => ({
        fns,
        secretId: change.documentKey._id,
        secretKeys: change.keys,
        operationType: change.operationType as ResourceOperationType
      }))
    );
  }
}
