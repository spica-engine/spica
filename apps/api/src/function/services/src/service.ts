import {Inject, Injectable} from "@nestjs/common";
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
import {Function} from "@spica-server/interface/function";
import {FunctionOptions, FUNCTION_OPTIONS} from "./options";
import {EnvVarsService} from "@spica-server/env_var/services";
import {filter, map, Observable, switchMap} from "rxjs";

const collectionName = "function";

@Injectable()
export class FunctionService extends BaseCollection<Function>(collectionName) {
  constructor(
    database: DatabaseService,
    private evs: EnvVarsService,
    @Inject(FUNCTION_OPTIONS) options: FunctionOptions
  ) {
    super(database, {
      entryLimit: options.entryLimit,
      afterInit: () => this.createIndex({env_vars: 1})
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
}
