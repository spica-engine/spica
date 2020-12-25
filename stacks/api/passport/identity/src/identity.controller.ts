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
import {DEFAULT, NUMBER, JSONP, BOOLEAN} from "@spica-server/core";
import {Schema} from "@spica-server/core/schema";
import {ObjectId, OBJECT_ID} from "@spica-server/database";
import {ActionGuard, AuthGuard, ResourceFilter} from "@spica-server/passport/guard";
import {PolicyService} from "@spica-server/passport/policy";
import {createIdentityActivity} from "./activity.resource";
import {hash} from "./hash";
import {IdentityService} from "./identity.service";
import {Identity, PaginationResponse} from "./interface";
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
  async find(
    @Query("limit", DEFAULT(0), NUMBER) limit: number,
    @Query("skip", DEFAULT(0), NUMBER) skip: number,
    @Query("sort", DEFAULT({}), JSONP) sort: object,
    @Query("paginate", DEFAULT(false), BOOLEAN) paginate: boolean,
    @Query("filter", DEFAULT({}), JSONP) filter: object,
    @ResourceFilter() resourceFilter: object
  ) {
    const pipeline: object[] = [];

    pipeline.push(resourceFilter);

    pipeline.push({$project: {password: 0}});

    pipeline.push({$set: {_id: {$toString: "$_id"}}});

    if (Object.keys(filter).length) {
      pipeline.push({$match: filter});
    }

    const seekingPipeline: object[] = [];

    if (Object.keys(sort).length) {
      pipeline.push({$sort: sort});
    }

    if (skip) {
      seekingPipeline.push({$skip: skip});
    }

    if (limit) {
      seekingPipeline.push({$limit: limit});
    }

    if (paginate) {
      pipeline.push(
        {
          $facet: {
            meta: [
              {
                $count: "total"
              }
            ],
            data: seekingPipeline
          }
        },
        {$unwind: {path: "$meta", preserveNullAndEmptyArrays: true}}
      );

      const result = await this.identity.aggregate<PaginationResponse<Identity>>(pipeline).next();

      return result.data.length ? result : {meta: {total: 0}, data: []};
    }

    return this.identity.aggregate<Identity>([...pipeline, ...seekingPipeline]).toArray();
  }
  @Get("predefs")
  @UseGuards(AuthGuard())
  getPredefinedDefaults() {
    return this.identity.getPredefinedDefaults();
  }

  @Get(":id")
  @UseGuards(AuthGuard(), ActionGuard("passport:identity:show"))
  findOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.identity.findOne({_id: id}, {projection: {password: 0}});
  }

  @UseInterceptors(activity(createIdentityActivity))
  @Post()
  @UseGuards(AuthGuard(), ActionGuard("passport:identity:create"))
  async insertOne(
    @Body(Schema.validate("http://spica.internal/passport/create-identity-with-attributes"))
    identity: Identity
  ) {
    identity.password = await hash(identity.password);
    identity.policies = [];
    return this.identity
      .insertOne(identity)
      .then(insertedIdentity => {
        delete insertedIdentity.password;
        return insertedIdentity;
      })
      .catch(exception => {
        if (exception.code === 11000) {
          throw new BadRequestException("Identity already exists.");
        }
        throw new InternalServerErrorException();
      });
  }

  @UseInterceptors(activity(createIdentityActivity))
  @Put(":id")
  @UseGuards(AuthGuard(), ActionGuard("passport:identity:update", undefined, attachIdentityAccess))
  async updateOne(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body(Schema.validate("http://spica.internal/passport/update-identity-with-attributes"))
    identity: Partial<Identity>
  ) {
    delete identity._id;
    if (identity.password) {
      identity.password = await hash(identity.password);
    }
    delete identity.policies;
    return this.identity.findOneAndUpdate(
      {_id: id},
      {$set: identity},
      {returnOriginal: false, projection: {password: 0}}
    );
  }

  @UseInterceptors(activity(createIdentityActivity))
  @Delete(":id")
  @UseGuards(AuthGuard(), ActionGuard("passport:identity:delete"))
  async deleteOne(@Param("id", OBJECT_ID) id: ObjectId) {
    // prevent to deleting the last user
    const users = await this.identity.find();
    if (users.length == 1) {
      return;
    }
    return this.identity.deleteOne({_id: id}).then(() => {});
  }

  @UseInterceptors(activity(createIdentityActivity))
  @Put(":id/policy/:policyId")
  @UseGuards(AuthGuard(), ActionGuard("passport:identity:policy:add"))
  async addPolicy(@Param("id", OBJECT_ID) id: ObjectId, @Param("policyId") policyId: string) {
    return this.identity.findOneAndUpdate(
      {
        _id: id
      },
      {
        $addToSet: {policies: policyId}
      },
      {
        returnOriginal: false,
        projection: {password: 0}
      }
    );
  }

  @UseInterceptors(activity(createIdentityActivity))
  @Delete(":id/policy/:policyId")
  @UseGuards(AuthGuard(), ActionGuard("passport:identity:policy:remove"))
  async removePolicy(@Param("id", OBJECT_ID) id: ObjectId, @Param("policyId") policyId: string) {
    return this.identity.findOneAndUpdate(
      {
        _id: id
      },
      {
        $pull: {policies: policyId}
      },
      {
        returnOriginal: false,
        projection: {password: 0}
      }
    );
  }
}
