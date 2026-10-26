import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Put,
  Query,
  UseGuards,
  Body,
  BadRequestException
} from "@nestjs/common";
import {BOOLEAN, DEFAULT, JSONP, NUMBER} from "@spica-server/core";
import {ID} from "@spica-server/data";
import {COLLECTION_QUERY, CollectionQueryFacade, Id, ReadSpec} from "@spica-server/interface-data";
import {ActionGuard, AuthGuard, ResourceFilter} from "@spica-server/passport-guard";
import {
  RefreshToken,
  PaginationResponse,
  REFRESH_TOKEN_REPOSITORY,
  RefreshTokenRepository
} from "@spica-server/interface-passport-refresh_token";
import {REFRESH_TOKEN_OPTIONS, RefreshTokenOptions} from "./options.js";
import {replaceRefreshTokenFilter} from "./filter.js";

@Controller("passport/refresh-token")
export class RefreshTokenController {
  private readonly HIDDEN_FIELDS = {token: 0} as const;

  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY) private refreshTokens: RefreshTokenRepository,
    @Inject(REFRESH_TOKEN_OPTIONS) private options: RefreshTokenOptions,
    @Inject(COLLECTION_QUERY) private queries: CollectionQueryFacade
  ) {}

  @Get()
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("passport:refresh-token:index"))
  async find(
    @Query("limit", DEFAULT(0), NUMBER) limit: number,
    @Query("skip", DEFAULT(0), NUMBER) skip: number,
    @Query("sort", JSONP) sort: {[path: string]: 1 | -1},
    @Query("paginate", DEFAULT(false), BOOLEAN) paginate: boolean,
    @Query("filter", JSONP) filter: object,
    @ResourceFilter({collection: "refresh_token"}) resourceFilter: object
  ) {
    const hashSecret = this.options.refreshTokenHashSecret;
    const spec: ReadSpec = {
      resourceFilter,
      filter,
      filterReplacers: hashSecret
        ? [async filter => replaceRefreshTokenFilter(filter, hashSecret)]
        : [],
      sort,
      skip,
      limit,
      fields: {...this.HIDDEN_FIELDS}
    };

    if (paginate) {
      return this.queries.paginate<RefreshToken>(
        "refresh_token",
        spec,
        "estimate-unless-filtered"
      ) as Promise<PaginationResponse<RefreshToken>>;
    }

    return this.queries.find<RefreshToken>("refresh_token", spec);
  }

  @Get(":id")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("passport:refresh-token:show"))
  findOne(@Param("id", ID("refresh_token")) id: Id) {
    return this.queries
      .findOne<RefreshToken>("refresh_token", {id, fields: {...this.HIDDEN_FIELDS}})
      .then(r => {
        if (!r) {
          throw new NotFoundException();
        }
        return r;
      });
  }

  @Put(":id")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("passport:refresh-token:update"))
  async update(@Param("id", ID("refresh_token")) id: Id, @Body() body: Partial<RefreshToken>) {
    const disabled = body?.disabled;

    if (typeof disabled !== "boolean") {
      throw new BadRequestException("Only disabled field can be updated and it must be a boolean");
    }

    const updatedToken = await this.refreshTokens.setDisabled(id, disabled);

    if (!updatedToken) {
      throw new NotFoundException();
    }

    return updatedToken;
  }

  @Delete(":id")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("passport:refresh-token:delete"))
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteOne(@Param("id", ID("refresh_token")) id: Id) {
    return this.refreshTokens.deleteById(id).then(r => {
      if (!r) {
        throw new NotFoundException();
      }
    });
  }
}
