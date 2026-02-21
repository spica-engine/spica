import {PipelineBuilder} from "@spica-server/database/pipeline";
import {replaceFilterDates, replaceFilterObjectIds} from "@spica-server/filter";
import {replaceRefreshTokenFilter} from "./filter";

export class RefreshTokenPipelineBuilder extends PipelineBuilder {
  constructor(private readonly hashSecret?: string) {
    const replacers = [replaceFilterObjectIds, replaceFilterDates];

    if (hashSecret) {
      const tokenHashReplacer = async (filter: object) =>
        replaceRefreshTokenFilter(filter, hashSecret);
      replacers.push(tokenHashReplacer);
    }

    super(replacers);
  }
}
