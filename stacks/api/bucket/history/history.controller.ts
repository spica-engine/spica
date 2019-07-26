import {Controller, Get, Param, Post, UseGuards} from "@nestjs/common";
import {ObjectId, OBJECT_ID} from "@spica-server/database";
import {AuthGuard} from "@spica-server/passport";
import * as diffMatchPatch from "diff-match-patch";
import {BucketDataService} from "../bucket-data.service";
import {HistoryService} from "./history.service";
import {resolve, setPropertyByPath} from "./utils";

@Controller("bucket/:bucketId/history/:documentId")
export class HistoryController {
  constructor(
    private historyService: HistoryService,
    private bucketDataService: BucketDataService
  ) {}

  // TODO: Add "ActionGuard"s to the below methods

  @Get()
  @UseGuards(AuthGuard())
  getHistories(@Param("bucketId", OBJECT_ID) id: ObjectId) {
    return this.historyService.getHistoryByBucketDataId(id);
  }

  @Post(":historyId")
  @UseGuards(AuthGuard())
  async revertTo(
    @Param("bucketId", OBJECT_ID) bucketId: ObjectId,
    @Param("documentId", OBJECT_ID) documentId: ObjectId,
    @Param("historyId", OBJECT_ID) historyId: ObjectId
  ) {
    const gDiff = new diffMatchPatch.diff_match_patch();

    const bucketEntry = await this.bucketDataService.findOne(bucketId, {_id: documentId});
    const historyArray = await this.historyService.findBetweenNow(historyId);
    historyArray
      .sort((a, b) => {
        return b.date - a.date;
      })
      .forEach(history => {
        history.changes.forEach(change => {
          const lhs = resolve(change.path, bucketEntry) || "";
          if (typeof lhs != "object") {
            setPropertyByPath(
              bucketEntry,
              change.path,
              gDiff.patch_apply(change.patch, lhs.toString())[0]
            );
          }
        });
      });
    return bucketEntry;
  }
}
