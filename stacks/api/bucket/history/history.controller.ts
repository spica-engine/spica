import {Controller, Get, Param, UseGuards} from "@nestjs/common";
import {ObjectId, OBJECT_ID} from "@spica-server/database";
import {AuthGuard} from "@spica-server/passport";
import {applyPatch} from "./differ";
import {HistoryService} from "./history.service";
import {compile} from "./schema";

@Controller("bucket/:bucketId/history/:documentId")
export class HistoryController {
  constructor(private historyService: HistoryService) {}

  @Get()
  @UseGuards(AuthGuard())
  getHistories(@Param("documentId", OBJECT_ID) id: ObjectId) {
    return this.historyService.find({document_id: id});
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
    const history = await this.historyService.findBetweenNow(historyId);
    const compiledSchema = compile(schema);
    history.forEach(history => applyPatch(history.changes, document, compiledSchema));
    return document;
  }
}
