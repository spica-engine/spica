import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Query,
  UseGuards,
  Inject
} from "@nestjs/common";
import {ActivityService} from "@spica-server/activity-services";
import {DATE, JSONP, NUMBER, DEFAULT, ARRAY} from "@spica-server/core";
import {ActionGuard, AuthGuard} from "@spica-server/passport-guard";
import {ID, ids} from "@spica-server/data";
import {
  COLLECTION_QUERY,
  CollectionQueryFacade,
  Id,
  ReadSpec,
  WhereCondition
} from "@spica-server/interface-data";

const ACTIVITY_COLLECTION = "activity";

const activityIds = () => ids().forCollection(ACTIVITY_COLLECTION);

const asList = (value: unknown, operator: string) => {
  if (!Array.isArray(value) || value.some(item => typeof item != "string")) {
    throw new BadRequestException(`${operator} of the resource filter must be a list of strings.`);
  }
  return value;
};

const resourceCondition = (resource: any): WhereCondition => {
  if (Array.isArray(resource)) {
    return {eq: asList(resource, "The filter")};
  }
  const {$all, $in, ...unknown} = resource ?? {};
  if (Object.keys(unknown).length || ($all === undefined && $in === undefined)) {
    throw new BadRequestException("The resource filter accepts only $all and $in.");
  }
  return {
    contains: {
      ...($all !== undefined && {all: asList($all, "$all")}),
      ...($in !== undefined && {any: asList($in, "$in")})
    }
  };
};

@Controller("activity")
export class ActivityController {
  constructor(
    private activityService: ActivityService,
    @Inject(COLLECTION_QUERY) private queries: CollectionQueryFacade
  ) {}

  @Get()
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("activity:index"))
  async find(
    @Query("identifier") identifier: string,
    @Query("username") username: string,
    @Query("action", DEFAULT([]), ARRAY(Number)) action: number[],
    @Query("resource", JSONP) resource: object,
    @Query("begin", DATE) begin: Date,
    @Query("end", DATE) end: Date,
    @Query("skip", NUMBER) skip: number,
    @Query("limit", NUMBER) limit: number
  ) {
    const where: ReadSpec["where"] = {
      ...(identifier && {identifier: {eq: identifier}}),
      ...(username && {username: {eq: username}}),
      ...(resource && {resource: resourceCondition(resource)}),
      ...(action?.length && {action: {in: action}})
    };
    const hasRange = begin?.getTime() && end?.getTime();

    return this.queries.find(ACTIVITY_COLLECTION, {
      relations: ["identifier", "username"],
      where: Object.keys(where).length ? where : undefined,
      createdBetween: hasRange ? {from: begin, to: end} : undefined,
      sort: {_id: -1},
      skip,
      limit
    });
  }

  @Delete(":id")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("activity:delete"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param("id", ID(ACTIVITY_COLLECTION)) id: Id) {
    const deletedCount = await this.activityService.deleteById(id);
    if (!deletedCount) {
      throw new NotFoundException(`Activity with ID ${id} not found`);
    }
  }

  @Delete()
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("activity:delete"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMany(@Body() ids: Id[]) {
    const deletedCount = await this.activityService.deleteByIds(
      ids.map(id => activityIds().parse(id))
    );
    if (!deletedCount) {
      throw new NotFoundException("No activities found with the provided IDs");
    }
  }
}
