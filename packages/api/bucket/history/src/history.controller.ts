import {
  Controller,
  Inject,
  Get,
  Param,
  UseGuards,
  Delete,
  HttpCode,
  HttpStatus,
  NotFoundException
} from "@nestjs/common";
import {BucketService, compile} from "@spica-server/bucket-services";
import {DocumentId, ID} from "@spica-server/data";
import {Id} from "@spica-server/interface-data";
import {ActionGuard, AuthGuard} from "@spica-server/passport-guard";
import {applyPatch} from "./differ.js";
import {HISTORY_REPOSITORY, HistoryRepository} from "@spica-server/interface-bucket-history";

const BUCKETS_COLLECTION = "buckets";

@Controller("bucket/:bucketId/history")
export class HistoryController {
  constructor(
    @Inject(HISTORY_REPOSITORY) private history: HistoryRepository,
    private bucketService: BucketService
  ) {}

  @Get(":documentId")
  @UseGuards(
    AuthGuard(["IDENTITY", "APIKEY"]),
    ActionGuard("bucket:data:index", "bucket/:bucketId/data")
  )
  getHistories(
    @Param("bucketId", ID(BUCKETS_COLLECTION)) bucket_id: Id,
    @DocumentId("documentId", "bucketId") document_id: Id
  ) {
    return this.history.findSummaries(bucket_id, document_id);
  }

  @Get(":documentId/:historyId")
  @UseGuards(
    AuthGuard(["IDENTITY", "APIKEY"]),
    ActionGuard("bucket:data:index", "bucket/:bucketId/data")
  )
  async revertTo(
    @Param("bucketId", ID(BUCKETS_COLLECTION)) bucketId: Id,
    @DocumentId("documentId", "bucketId") documentId: Id,
    @Param("historyId", ID("history")) historyId: Id
  ) {
    const document = await this.history.getDocument(bucketId, documentId);
    const schema = await this.bucketService.findById(bucketId);
    const histories = await this.history.findSince(bucketId, documentId, historyId);
    const preferences = await this.bucketService.getPreferences();
    const compiledSchema = compile(schema, preferences);
    for (const history of histories) {
      applyPatch(history.changes, document, compiledSchema);
    }
    return document;
  }

  @Delete()
  @UseGuards(
    AuthGuard(["IDENTITY", "APIKEY"]),
    ActionGuard("bucket:data:delete", "bucket/:bucketId/data")
  )
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearHistories(@Param("bucketId", ID(BUCKETS_COLLECTION)) bucketId: Id) {
    const deletedCount = await this.history.deleteByBucket(bucketId);
    if (!deletedCount) {
      throw new NotFoundException("No bucket history found with the provided IDs");
    }
  }
}
