import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  NotFoundException,
  HttpCode,
  HttpStatus
} from "@nestjs/common";
import {NUMBER, JSONP} from "@spica-server/core";
import {ObjectId, OBJECT_ID} from "@spica-server/database";
import {SyncPipelineBuilder} from "./pipeline.builder";
import {ActionGuard, AuthGuard} from "@spica-server/passport/guard";
import {SyncService} from "@spica-server/versioncontrol/services/sync";
import {Sync, SyncStatuses} from "@spica-server/interface/versioncontrol";

/**
 * All APIs related to version control synchronization.
 * @name sync
 */
@Controller("versioncontrol/sync")
export class SyncController {
  constructor(private syncService: SyncService) {}

  /**
   * Returns all synchronization changes with optional filtering, limiting, skipping and sorting.
   * @query filter - Optional filter criteria
   * @query limit - Maximum number of results to return
   * @query skip - Number of results to skip
   * @query sort - Sort order (e.g., {created_at: -1})
   * @query initiator - Filter by resource origin: "external" (default), "internal", or "all" to show all resources
   */
  @Get()
  @UseGuards(AuthGuard(), ActionGuard("versioncontrol:show", "versioncontrol"))
  async getAllSync(
    @Query("filter", JSONP) filter?: object,
    @Query("limit", NUMBER) limit?: number,
    @Query("skip", NUMBER) skip?: number,
    @Query("sort", JSONP) sort?: object
  ): Promise<Sync[]> {
    const builder = new SyncPipelineBuilder();

    await builder.filterByUserRequest(filter);
    builder.sort(sort).skip(skip).limit(limit);

    const pipeline = builder.result();

    return this.syncService.aggregate<Sync>(pipeline).toArray();
  }

  /**
   * Updates a sync record status.
   * Only syncs with PENDING status can be updated to APPROVED or REJECTED.
   * @param id - Identifier of the sync record
   * @body {
   *   "status": "APPROVED" | "REJECTED",
   * }
   */
  @Put(":id")
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard(), ActionGuard("versioncontrol:update", "versioncontrol"))
  async updateSync(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body("status") status: SyncStatuses
  ): Promise<Sync> {
    const allowedStatuses = [SyncStatuses.APPROVED, SyncStatuses.REJECTED];
    if (!allowedStatuses.includes(status)) {
      throw new BadRequestException(
        `Invalid status. Only APPROVED or REJECTED statuses are allowed.`
      );
    }

    const update: Partial<Sync> = {
      status,
      updated_at: new Date()
    };

    const updatedSync = await this.syncService.findOneAndUpdate(
      {_id: id, status: SyncStatuses.PENDING},
      {$set: update},
      {returnDocument: "after"}
    );

    if (!updatedSync) {
      const existingSync = await this.syncService.findOne({_id: id});
      if (!existingSync) {
        throw new NotFoundException(`Sync record with id ${id} does not exist.`);
      }
      throw new BadRequestException(
        `Only syncs with PENDING status can be updated. Current status: ${existingSync.status}`
      );
    }

    return updatedSync;
  }
}
