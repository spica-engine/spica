import {PipelineBuilder} from "@spica-server/database/pipeline";
import {ChangeInitiator} from "@spica-server/interface/versioncontrol";

export class SyncPipelineBuilder extends PipelineBuilder {
  async filterByUserRequest(filter: object, initiator?: "external" | "internal" | "all") {
    if (initiator !== "all") {
      const filterInitiator =
        initiator === "internal" ? ChangeInitiator.INTERNAL : ChangeInitiator.EXTERNAL;
      filter = {...filter, "change_log.initiator": filterInitiator};
    }

    return super.filterByUserRequest(filter);
  }
}
