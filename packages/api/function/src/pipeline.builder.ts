import {ObjectId} from "@spica-server/database";
import {PipelineBuilder} from "@spica-server/database-pipeline";
import {EnvRelation, SecretRelation} from "@spica-server/interface-function";

export class FunctionPipelineBuilder extends PipelineBuilder {
  /**
   * `resolveEnvRelation`/`resolveSecretRelation`/`hideSecrets` were **removed**.
   *
   * All three worked with `$lookup`/`$project` and, because `localField` is an **array** of ids, that
   * `$lookup` shape differed from the others. The resolution moved to `crud.ts:resolveRelations`: the same
   * on both backends, without an N+1, and with the secret hiding explicit in the code. The rationale is
   * written down in `crud.ts`.
   */
  filterByEnvVars(envVars: ObjectId[]) {
    const filter = {
      $match: {
        env_vars: {
          $in: envVars
        }
      }
    };
    return this.attachToPipeline(envVars && envVars.length, filter);
  }

  filterByLanguage(language: string) {
    const filter = {
      $match: {
        language: language
      }
    };
    return this.attachToPipeline(language, filter);
  }
}
