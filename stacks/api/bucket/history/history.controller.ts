import {Controller, Get, Param, UseGuards} from "@nestjs/common";
import {BucketService, compile} from "@spica-server/bucket/services";
import {ObjectId, OBJECT_ID} from "@spica-server/database";
import {AuthGuard} from "@spica-server/passport";
import {applyPatch} from "./differ";
import {HistoryService} from "./history.service";

@Controller("bucket/:bucketId/history/:documentId")
export class HistoryController {
  constructor(private historyService: HistoryService, private bucketService: BucketService) {}

  @Get()
  @UseGuards(AuthGuard())
  getHistories(
    @Param("bucketId", OBJECT_ID) bucket_id: ObjectId,
    @Param("documentId", OBJECT_ID) document_id: ObjectId
  ) {
    return this.historyService.find({$and: [{bucket_id: bucket_id}, {document_id: document_id}]});
  }

  @Get(":historyId")
  @UseGuards(AuthGuard())
  async revertTo(
    @Param("bucketId", OBJECT_ID) bucketId: ObjectId,
    @Param("documentId", OBJECT_ID) documentId: ObjectId,
    @Param("historyId", OBJECT_ID) historyId: ObjectId
  ) {
    const document = await this.historyService.getDocument(bucketId, documentId);
    const schema = await this.bucketService.findOne({_id: bucketId});
    const histories = await this.historyService.findBetweenNow(bucketId, documentId, historyId);
    const preferences = await this.bucketService.getPreferences();
    const compiledSchema = compile(schema, preferences);
    for (const history of histories) {
      applyPatch(history.changes, document, compiledSchema);
    }
    return document;
  }
}
