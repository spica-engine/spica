import {PipelineBuilder} from "@spica-server/database/pipeline";
import {ChangeInitiator} from "@spica-server/interface/versioncontrol";

export class SyncPipelineBuilder extends PipelineBuilder {
  async filterByUserRequest(filter: object) {
    filter = this.assignInitiatorToFilter(filter);
    return super.filterByUserRequest(filter);
  }

  private assignInitiatorToFilter(filter) {
    filter = filter || {};
    if (!filter["change_log.initiator"] && !filter.change_log?.initiator) {
      filter["change_log.initiator"] = ChangeInitiator.EXTERNAL;
    }
    return filter;
  }
}
