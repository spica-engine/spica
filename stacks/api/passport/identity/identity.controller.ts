import {Schema} from "@spica-server/core/schema";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  InternalServerErrorException,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  Req
} from "@nestjs/common";
import {PassportService} from "../passport.service";
import {Identity} from "./interface";
import {IdentityService} from "./identity.service";
import {NUMBER} from "@spica-server/core";
import {AuthGuard} from "@nestjs/passport";
import {ActionGuard, PolicyService} from "../policy";
import {OBJECT_ID, ObjectId} from "@spica-server/database";
@Controller("passport/identity")
export class IdentityController {
  constructor(
    private passport: PassportService,
    private identity: IdentityService,
    private policy: PolicyService
  ) {}
  @Get("statements")
  @UseGuards(AuthGuard())
  async statements(@Req() req) {
    if (!req.user.policies) {
      return [];
    }
    const policies = await this.policy._findAll();
    const identityPolicies = req.user.policies.map(p => policies.find(pp => pp._id == p));
    return Array.prototype.concat.apply(
      [],
      identityPolicies.filter(item => item).map(ip => ip.statement)
    );
  }
  @Get()
  @UseGuards(AuthGuard(), ActionGuard("passport:identity:index"))
  find(@Query("limit", NUMBER) limit: number, @Query("skip", NUMBER) skip: number) {
    const aggregate = [
      {
        $facet: {
          meta: [{$count: "total"}],
          data: [{$skip: skip}, {$limit: limit || 10}]
        }
      },
      {
        $project: {
          meta: {$arrayElemAt: ["$meta", 0]},
          data: "$data"
        }
      }
    ];
    return this.identity
      .find(aggregate)
      .then(result => (result && result[0]) || Promise.reject("Cannot found."));
  }
  @Get("predefs")
  @UseGuards(AuthGuard(), ActionGuard("passport:identity:show"))
  getPredefinedDefaults() {
    return this.identity.getPredefinedDefaults();
  }

  @Get(":id")
  @UseGuards(AuthGuard(), ActionGuard("passport:identity:show"))
  async findOne(@Param("id", OBJECT_ID) id: ObjectId) {
    const identity = await this.identity.findOne({_id: id});
    delete identity.password;
    return identity;
  }
  @Post("create")
  @UseGuards(AuthGuard(), ActionGuard("passport:identity:create"))
  insertOne(
    @Body(Schema.validate("http://spica.internal/passport/create-identity-with-attributes"))
    identity: Identity
  ) {
    return this.passport.create(identity).catch(exception => {
      if (exception.code === 11000) {
        throw new BadRequestException("User already exists.");
      }
      throw new InternalServerErrorException();
    });
  }
  @Post(":id")
  // TODO(thesayyn): Check if user updates its own identity.
  @UseGuards(AuthGuard() /*, ActionGuard('passport:identity:update')*/)
  updateOne(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body(Schema.validate("http://spica.internal/passport/update-identity-with-attributes"))
    identity: Identity
  ) {
    return this.identity.updateOne(id, identity);
  }
  @Delete(":id")
  @UseGuards(AuthGuard(), ActionGuard("passport:identity:delete"))
  deleteOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.identity.deleteOne({_id: id});
  }
  // TODO(thesayyn): Strictly check policies before attaching them
  @Put(":id/attach-policy")
  @UseGuards(AuthGuard(), ActionGuard("passport:identity:policy"))
  async attachPolicy(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body(Schema.validate("http://spica.internal/passport/policy-list")) policies: string[]
  ) {
    const identity = await this.identity.findOne({_id: id});
    delete identity.password;
    // Merge policies and remove duplicate policies.
    identity.policies = new Array(...identity.policies, ...policies).filter(
      (policy, index, array) => {
        return array.indexOf(policy) === index;
      }
    );
    await this.identity.updateOne(id, identity);
    return identity;
  }
  @Put(":id/detach-policy")
  @UseGuards(AuthGuard(), ActionGuard("passport:identity:policy"))
  async detachPolicy(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body(Schema.validate("http://spica.internal/passport/policy-list")) policies: string[]
  ) {
    const identity = await this.identity.findOne({_id: id});
    delete identity.password;
    // Filter policies that will be removed
    identity.policies = new Array(...identity.policies).filter(
      policy => policies.indexOf(policy) === -1
    );
    await this.identity.updateOne(id, identity);
    return identity;
  }
}
