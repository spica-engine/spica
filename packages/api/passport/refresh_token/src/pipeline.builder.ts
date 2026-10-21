import {PipelineBuilder} from "@spica-server/database-pipeline";
import {ids} from "@spica-server/data";
import {replaceFilterDates, replaceFilterObjectIds} from "@spica-server/filter";
import {replaceRefreshTokenFilter} from "./filter.js";

export class RefreshTokenPipelineBuilder extends PipelineBuilder {
  constructor(private readonly hashSecret?: string) {
    const replaceIds = (filter: object) =>
      replaceFilterObjectIds(filter, ids().forCollection("refresh_token"));
    const replacers = [replaceIds, replaceFilterDates];

    if (hashSecret) {
      const tokenHashReplacer = async (filter: object) =>
        replaceRefreshTokenFilter(filter, hashSecret);
      replacers.push(tokenHashReplacer);
    }

    super(replacers);
  }
}
