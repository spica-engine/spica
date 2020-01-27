import {Controller, Get, Param, UseGuards} from "@nestjs/common";
import {ObjectId, OBJECT_ID} from "@spica-server/database";
import {AuthGuard} from "../../passport/auth.guard";
import {applyPatch} from "./differ";
import {HistoryService} from "./history.service";
import {compile} from "./schema";

@Controller("bucket/:bucketId/history/:documentId")
export class HistoryController {
  constructor(private historyService: HistoryService) {}

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
    const schema = await this.historyService.getSchema(bucketId);
    const history = await this.historyService.findBetweenNow(bucketId, documentId, historyId);
    const compiledSchema = compile(schema);
    history.forEach(history => applyPatch(history.changes, document, compiledSchema));
    return document;
  }
}
