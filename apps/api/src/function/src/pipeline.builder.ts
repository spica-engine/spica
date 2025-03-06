import {PipelineBuilder} from "@spica-server/database/pipeline";
import {EnvRelation} from "@spica-server/interface/function";

export class FunctionPipelineBuilder extends PipelineBuilder {
  resolveEnvRelation(shouldResolve: EnvRelation) {
    const aggregations = [
      {
        $lookup: {
          from: "functions",
          localField: "env_vars",
          foreignField: "_id",
          as: "env_vars"
        }
      }
    ];

    return this.attachToPipeline(shouldResolve == EnvRelation.Resolved, aggregations);
  }
}
