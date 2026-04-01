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
  HttpCode,
  HttpStatus
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
} from "@spica-server/interface/passport/policy";
import {PolicyService} from "./policy.service";
import * as CRUD from "./crud";

@Controller("passport/policy")
export class PolicyController {
  constructor(
    private policy: PolicyService,
    @Optional() @Inject(APIKEY_POLICY_FINALIZER) private apikeyFinalizer: changeFactory,
    @Optional() @Inject(IDENTITY_POLICY_FINALIZER) private identityFinalizer: changeFactory
  ) {}

  @Get()
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("passport:policy:index"))
  find(
    @Query("filter", DEFAULT({}), JSONP) filter: object,
    @ResourceFilter() resourceFilter?: object,
    @Query("limit", NUMBER) limit?: number,
    @Query("skip", NUMBER) skip?: number
  ) {
    return CRUD.find(this.policy, filter, limit, skip);
  }

  @Get(":id")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("passport:policy:show"))
  findOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return CRUD.findOne(this.policy, id);
  }

  @UseInterceptors(activity(createPolicyActivity))
  @Post()
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("passport:policy:create"))
  insertOne(@Body(Schema.validate("http://spica.internal/passport/policy")) body: Policy) {
    return CRUD.insert(this.policy, body);
  }

  @UseInterceptors(activity(createPolicyActivity))
  @Put(":id")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("passport:policy:update"))
  async replaceOne(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body(Schema.validate("http://spica.internal/passport/policy")) body: Policy
  ) {
    return CRUD.replace(this.policy, {_id: id, ...body});
  }

  @UseInterceptors(activity(createPolicyActivity))
  @Delete(":id")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("passport:policy:delete"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return CRUD.remove(this.policy, id, this.apikeyFinalizer, this.identityFinalizer);
  }
}
