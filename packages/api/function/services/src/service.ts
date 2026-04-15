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
import {filter, map, Observable, switchMap} from "rxjs";
import {Function, FunctionOptions, FUNCTION_OPTIONS} from "@spica-server/interface-function";

const collectionName = "function";

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
      collectionOptions: {changeStreamPreAndPostImages: {enabled: true}},
      afterInit: () =>
        Promise.all([
          this.createIndex({env_vars: 1}),
          this.createIndex({secrets: 1}),
          this.createIndex({name: 1}, {unique: true})
        ])
    });
  }

  watchFunctionsForEnvChanges(): Observable<{
    fns: WithId<Function>[];
    envVarId: ObjectId;
    operationType: "replace" | "update" | "delete";
  }> {
    const watchPipeline = [
      {
        $match: {
          operationType: {
            $in: ["update", "replace", "delete"]
          }
        }
      }
    ];
    const filterOnlyDocumentIds = change => !!change.documentKey?._id;
    const mapChangeToUpdate = change => {
      return {
        envVarId: change.documentKey?._id,
        operationType: change.operationType
      };
    };

    const getFunctionsOfEnv = ({envVarId, operationType}) =>
      this.find({
        env_vars: {
          $in: [envVarId]
        }
      }).then(fns => {
        return {
          fns,
          envVarId,
          operationType
        };
      });

    return this.evs
      .watch(watchPipeline)
      .pipe(filter(filterOnlyDocumentIds), map(mapChangeToUpdate), switchMap(getFunctionsOfEnv));
  }

  watchFunctionsForSecretChanges(): Observable<{
    fns: WithId<Function>[];
    secretId: ObjectId;
    operationType: "replace" | "update" | "delete";
  }> {
    const watchPipeline = [
      {
        $match: {
          operationType: {
            $in: ["update", "replace", "delete"]
          }
        }
      }
    ];
    const filterOnlyDocumentIds = change => !!change.documentKey?._id;
    const mapChangeToUpdate = change => {
      return {
        secretId: change.documentKey?._id,
        operationType: change.operationType
      };
    };

    const getFunctionsOfSecret = ({secretId, operationType}) =>
      this.find({
        secrets: {
          $in: [secretId]
        }
      }).then(fns => {
        return {
          fns,
          secretId,
          operationType
        };
      });

    return this.ss
      .watch(watchPipeline)
      .pipe(filter(filterOnlyDocumentIds), map(mapChangeToUpdate), switchMap(getFunctionsOfSecret));
  }
}
