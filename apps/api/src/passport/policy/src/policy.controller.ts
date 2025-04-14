import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
  Optional,
  Inject,
  BadRequestException,
  NotFoundException
} from "@nestjs/common";
import {activity} from "@spica-server/activity/services";
import {NUMBER, DEFAULT, JSONP} from "@spica-server/core";
import {Schema} from "@spica-server/core/schema";
import {ObjectId, OBJECT_ID} from "@spica-server/database";
import {ActionGuard, AuthGuard, ResourceFilter} from "@spica-server/passport/guard";
import {createPolicyActivity} from "./activity.resource";
import {
  Policy,
  APIKEY_POLICY_FINALIZER,
  changeFactory,
  IDENTITY_POLICY_FINALIZER
} from "./interface";
import {PolicyService} from "./policy.service";
import {getDuplicatedActionMaps, createDuplicatedActionsErrorMessage} from "./utility";

@Controller("passport/policy")
export class PolicyController {
  constructor(
    private policy: PolicyService,
    @Optional() @Inject(APIKEY_POLICY_FINALIZER) private apikeyFinalizer: changeFactory,
    @Optional() @Inject(IDENTITY_POLICY_FINALIZER) private identityFinalizer: changeFactory
  ) {}

  @Get()
  @UseGuards(AuthGuard(), ActionGuard("passport:policy:index"))
  find(
    @Query("filter", DEFAULT({}), JSONP) filter: object,
    @ResourceFilter() resourceFilter?: object,
    @Query("limit", NUMBER) limit?: number,
    @Query("skip", NUMBER) skip?: number
  ) {
    return this.policy.paginate(filter, limit, skip);
  }

  @Get(":id")
  @UseGuards(AuthGuard(), ActionGuard("passport:policy:show"))
  findOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.policy.findOne(id);
  }

  @UseInterceptors(activity(createPolicyActivity))
  @Post()
  @UseGuards(AuthGuard(), ActionGuard("passport:policy:create"))
  insertOne(@Body(Schema.validate("http://spica.internal/passport/policy")) body: Policy) {
    const duplicatedActionMaps = getDuplicatedActionMaps(body);

    if (duplicatedActionMaps.length) {
      const message = createDuplicatedActionsErrorMessage(duplicatedActionMaps);
      throw new BadRequestException(message);
    }

    return this.policy.insertOne(body);
  }

  @UseInterceptors(activity(createPolicyActivity))
  @Put(":id")
  @UseGuards(AuthGuard(), ActionGuard("passport:policy:update"))
  async replaceOne(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body(Schema.validate("http://spica.internal/passport/policy")) body: Policy
  ) {
    const duplicatedActionMaps = getDuplicatedActionMaps(body);

    if (duplicatedActionMaps.length) {
      const message = createDuplicatedActionsErrorMessage(duplicatedActionMaps);
      throw new BadRequestException(message);
    }
    const res = await this.policy.replaceOne({_id: id}, body);

    if (!res) {
      throw new NotFoundException(`Policy with ID ${id} not found`);
    }
    return res;
  }

  @UseInterceptors(activity(createPolicyActivity))
  @Delete(":id")
  @UseGuards(AuthGuard(), ActionGuard("passport:policy:delete"))
  async deleteOne(@Param("id", OBJECT_ID) id: ObjectId) {
    if (this.apikeyFinalizer) {
      await this.apikeyFinalizer(id.toHexString());
    }

    if (this.identityFinalizer) {
      await this.identityFinalizer(id.toHexString());
    }

    const res = await this.policy.deleteOne({_id: id});

    if (!res) {
      throw new NotFoundException(`Policy with ID ${id} not found`);
    }
    return res;
  }
}
