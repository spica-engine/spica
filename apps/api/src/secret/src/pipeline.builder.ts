import {PipelineBuilder} from "@spica-server/database/pipeline";

export class SecretPipelineBuilder extends PipelineBuilder {
  hideSecrets(): this {
    this.pipeline.push({$project: {value: 0}});
    return this;
  }
}
