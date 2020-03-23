import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
  Query,
  Put,
  UseInterceptors
} from "@nestjs/common";
import {Schema} from "@spica-server/core/schema";
import {ObjectId, OBJECT_ID} from "@spica-server/database";
import {AuthGuard} from "../auth.guard";
import {ActionGuard} from "./action.guard";
import {Policy} from "./interface";
import {PolicyService} from "./policy.service";
import {NUMBER} from "@spica-server/core";
import {ActivityInterceptor, createPolicyResource} from "@spica-server/activity";

@Controller("passport/policy")
export class PolicyController {
  constructor(private policy: PolicyService) {}

  @Get()
  @UseGuards(AuthGuard(), ActionGuard("passport:policy:index"))
  find(@Query("limit", NUMBER) limit?: number, @Query("skip", NUMBER) skip?: number) {
    return this.policy.find(limit, skip);
  }

  // TODO: use special action for this
  @Get("services")
  @UseGuards(AuthGuard(), ActionGuard("passport:policy:index"))
  findPermissions() {
    return this.policy.services;
  }

  @Get(":id")
  @UseGuards(AuthGuard(), ActionGuard("passport:policy:show"))
  findOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.policy.findOne(id);
  }

  @UseInterceptors(ActivityInterceptor(createPolicyResource))
  @Post()
  @UseGuards(AuthGuard(), ActionGuard("passport:policy:update"))
  insertOne(@Body() body: Policy) {
    return this.policy.insertOne(body);
  }

  @UseInterceptors(ActivityInterceptor(createPolicyResource))
  @Put(":id")
  @UseGuards(AuthGuard(), ActionGuard("passport:policy:update"))
  replaceOne(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body(Schema.validate("http://spica.internal/passport/policy")) body: Policy
  ) {
    return this.policy.replaceOne({_id: id}, body);
  }

  @UseInterceptors(ActivityInterceptor(createPolicyResource))
  @Delete(":id")
  @UseGuards(AuthGuard(), ActionGuard("passport:policy:delete"))
  deleteOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.policy.deleteOne(id);
  }
}
