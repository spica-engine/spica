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
  Req,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import {activity} from "@spica-server/activity/services";
import {DEFAULT, NUMBER} from "@spica-server/core";
import {Schema} from "@spica-server/core/schema";
import {ObjectId, OBJECT_ID} from "@spica-server/database";
import {ActionGuard, AuthGuard, ResourceFilter} from "@spica-server/passport/guard";
import {PolicyService} from "@spica-server/passport/policy";
import {createIdentityActivity} from "./activity.resource";
import {hash} from "./hash";
import {IdentityService} from "./identity.service";
import {Identity} from "./interface";
import {attachIdentityAccess} from "./utility";

@Controller("passport/identity")
export class IdentityController {
  constructor(private identity: IdentityService, private policy: PolicyService) {}

  // TODO: try to drop direct dependency on policy service
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
  find(
    @Query("limit", DEFAULT(0), NUMBER) limit: number,
    @Query("skip", DEFAULT(0), NUMBER) skip: number,
    @ResourceFilter() resourceFilter: object
  ) {
    let dataPipeline: object[] = [];

    dataPipeline.push({$skip: skip});

    if (limit) dataPipeline.push({$limit: limit});

    const aggregate = [
      resourceFilter,
      {
        $facet: {
          meta: [{$count: "total"}],
          data: dataPipeline
        }
      },
      {
        $project: {
          meta: {$arrayElemAt: ["$meta", 0]},
          data: "$data"
        }
      }
    ];

    return this.identity.aggregate(aggregate).next();
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

  @UseInterceptors(activity(createIdentityActivity))
  @Post()
  @UseGuards(AuthGuard(), ActionGuard("passport:identity:create"))
  async insertOne(
    @Body(Schema.validate("http://spica.internal/passport/create-identity-with-attributes"))
    identity: Identity
  ) {
    identity.password = await hash(identity.password);
    return this.identity.insertOne(identity).catch(exception => {
      if (exception.code === 11000) {
        throw new BadRequestException("Identity already exists.");
      }
      throw new InternalServerErrorException();
    });
  }

  @UseInterceptors(activity(createIdentityActivity))
  @Put(":id")
  @UseGuards(AuthGuard(), ActionGuard("passport:identity:update", undefined, attachIdentityAccess))
  updateOne(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body(Schema.validate("http://spica.internal/passport/update-identity-with-attributes"))
    identity: Identity
  ) {
    return this.identity.updateOne(id, identity);
  }

  @UseInterceptors(activity(createIdentityActivity))
  @Delete(":id")
  @UseGuards(AuthGuard(), ActionGuard("passport:identity:delete"))
  deleteOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.identity.deleteOne({_id: id}).then(() => {});
  }

  // TODO(thesayyn): Strictly check policies before attaching them
  @UseInterceptors(activity(createIdentityActivity))
  @Put(":id/attach-policy")
  @UseGuards(AuthGuard(), ActionGuard("passport:identity:policy"))
  async attachPolicy(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body(Schema.validate("http://spica.internal/passport/policy-list")) policies: string[]
  ) {
    const identity = await this.identity.findOne({_id: id});
    delete identity.password;
    // Merge policies and remove duplicate policies.
    identity.policies = new Array(...new Set([...identity.policies, ...policies]));
    await this.identity.updateOne(id, identity);
    return identity;
  }

  @UseInterceptors(activity(createIdentityActivity))
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
