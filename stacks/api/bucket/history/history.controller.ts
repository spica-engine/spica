import {Controller, Get, Param, Post} from "@nestjs/common";
import {ObjectId} from "@spica-server/database";
import * as diffMatchPatch from "diff-match-patch";
import {BucketDataService} from "../bucket-data.service";
import {HistoryService} from "./history.service";
import {resolve, setPropertyByPath} from "./utils";
import {OBJECT_ID} from "@spica-server/database";

@Controller("bucket/:bid/history/:id")
export class HistoryController {
  constructor(
    private historyService: HistoryService,
    private bucketDataService: BucketDataService
  ) {}

  // TODO: Add "ActionGuard"s to the below methods

  @Get()
  // @UseGuards(AuthGuard(), ActionGuard('bucket:data:index'))
  getHistories(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.historyService.getHistoryByBucketDataId(id);
  }

  @Post(":historyId")
  // @UseGuards(AuthGuard(), ActionGuard('bucket:data:index'))
  async revertTo(
    @Param("bid", OBJECT_ID) bid: ObjectId,
    @Param("id", OBJECT_ID) id: ObjectId,
    @Param("historyId", OBJECT_ID) historyId: ObjectId
  ) {
    const gDiff = new diffMatchPatch.diff_match_patch();

    const bucketEntry = await this.bucketDataService.findOne(bid, {_id: id});
    const historyArray = await this.historyService.findBetweenNow(historyId);
    historyArray
      .sort((a, b) => {
        return b.date - a.date;
      })
      .forEach(history => {
        history.changes.forEach(change => {
          const lhs = resolve(change.path, bucketEntry);
          if (typeof lhs === "string") {
            setPropertyByPath(bucketEntry, change.path, gDiff.patch_apply(change.patch, lhs)[0]);
          } else if (typeof lhs === "object") {
            // TODO: Handle non-primitives
            // setPropertyByPath(bucketEntry, change.path, applyChange({}, bucketEntry, change))
          }
        });
      });
    return bucketEntry;
  }
}
