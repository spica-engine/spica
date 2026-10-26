import {Inject, Injectable, Optional} from "@nestjs/common";
import {EnvVarService} from "@spica-server/env_var-services";
import {Id} from "@spica-server/interface-data";
import {SecretService} from "@spica-server/secret-services";
import {CollectionChangeEvent} from "@spica-server/replication";
import {filter, map, Observable, switchMap} from "rxjs";
import {
  FUNCTION_REPOSITORY,
  FunctionRepository,
  StoredFunction
} from "@spica-server/interface-function";

// An env-var/secret insert has no functions referencing it yet, so only these operations
// can affect an existing function's resolved environment.
const relevantOperations = ["update", "replace", "delete"];
const isRelevantOperation = (change: CollectionChangeEvent) =>
  relevantOperations.includes(change.operationType);

type ResourceOperationType = "replace" | "update" | "delete";

export interface EnvVarFunctionsChange {
  fns: StoredFunction[];
  envVarId: Id;
  operationType: ResourceOperationType;
}

export interface SecretFunctionsChange {
  fns: StoredFunction[];
  secretId: Id;
  secretKeys: string[];
  operationType: ResourceOperationType;
}

@Injectable()
export class FunctionService {
  constructor(
    @Inject(FUNCTION_REPOSITORY) private functions: FunctionRepository,
    private evs: EnvVarService,
    private ss: SecretService
  ) {}

  private watchFunctionsForResource<E extends CollectionChangeEvent>(
    changes: Observable<E>,
    resourceField: "env_vars" | "secrets"
  ): Observable<{fns: StoredFunction[]; change: E}> {
    return changes.pipe(
      filter(change => isRelevantOperation(change)),
      switchMap(change =>
        this.functions
          .findReferencing(resourceField, change.documentKey._id)
          .then(fns => ({fns, change}))
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
