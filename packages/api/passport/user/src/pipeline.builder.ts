import {PipelineBuilder} from "@spica-server/database-pipeline";
import {UserService} from "./user.service.js";
import {replaceProviderFilter} from "./filter.js";
import {replaceFilterDates, replaceFilterObjectIds} from "@spica-server/filter";
import {ids} from "@spica-server/data";

export class UserPipelineBuilder extends PipelineBuilder {
  constructor(private readonly userService: UserService) {
    const filterProviderReplacer = async (filter: object) =>
      replaceProviderFilter(filter, value => this.userService.hashProviderValue(value));
    const replaceIds = (filter: object) =>
      replaceFilterObjectIds(filter, ids().forCollection("user"));
    super([filterProviderReplacer, replaceIds, replaceFilterDates]);
  }
}
