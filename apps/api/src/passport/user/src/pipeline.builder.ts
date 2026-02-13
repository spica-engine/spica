import {PipelineBuilder} from "@spica-server/database/pipeline";
import {UserService} from "./user.service";
import {replaceProviderFilter} from "./filter";
import {replaceFilterDates, replaceFilterObjectIds} from "@spica-server/filter";

export class UserPipelineBuilder extends PipelineBuilder {
  constructor(private userService: UserService) {
    const filterProviderReplacer = async (filter: object) =>
      replaceProviderFilter(filter, value => this.userService.hashProviderValue(value));
    super([filterProviderReplacer, replaceFilterObjectIds, replaceFilterDates]);
  }
}
