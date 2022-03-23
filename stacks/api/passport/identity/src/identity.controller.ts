import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  HttpStatus,
  HttpCode,
  Headers,
  Inject,
  UnauthorizedException,
  InternalServerErrorException
} from "@nestjs/common";
import {activity} from "@spica-server/activity/services";
import {DEFAULT, NUMBER, JSONP, BOOLEAN} from "@spica-server/core";
import {Schema} from "@spica-server/core/schema";
import {ObjectId, OBJECT_ID} from "@spica-server/database";
import {ActionGuard, AuthGuard, ResourceFilter} from "@spica-server/passport/guard";
import {Factor, FactorMeta, schemas, TwoFactorAuth} from "@spica-server/passport/twofactorauth";
import {createIdentityActivity} from "./activity.resource";
import {hash} from "./hash";
import {IdentityService} from "./identity.service";
import {Identity, PaginationResponse} from "./interface";
import {POLICY_PROVIDER} from "./options";
import {registerPolicyAttacher} from "./utility";

@Controller("passport/identity")
export class IdentityController {
  identityFactors = new Map<string, Factor>();

  constructor(
    private identityService: IdentityService,
    @Inject(POLICY_PROVIDER)
    private identityPolicyResolver: (req: any) => Promise<[{statement: []}]>,
    private twoFactorAuth: TwoFactorAuth
  ) {
    this.identityService.find({}).then(identities => {
      for (const identity of identities) {
        if (identity.authFactor) {
          this.twoFactorAuth.register(identity._id.toHexString(), identity.authFactor);
        }
      }
    });
  }

  @Get("verify")
  verify(@Headers("Authorization") token: string) {
    if (!token) {
      throw new BadRequestException("Authorization header is missing.");
    }

    return this.identityService.verify(token).catch(e => {
      throw new BadRequestException(e.message);
    });
  }

  @Get("statements")
  @UseGuards(AuthGuard())
  async statements(@Req() req) {
    req.user.policies = req.user.policies || [];

    const identityPolicies = await this.identityPolicyResolver(req);

    return identityPolicies
      .filter(i => i)
      .map(ip => ip.statement)
      .reduce((acc, curr) => {
        return acc.concat(curr);
      }, []);
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

    //@TODO: remove this line
    pipeline.push({$set: {_id: {$toString: "$_id"}}});

    if (Object.keys(filter).length) {
      pipeline.push({$match: filter});
    }

    const seekingPipeline: object[] = [];

    if (Object.keys(sort).length) {
      seekingPipeline.push({$sort: sort});
    }

    // sub-pipeline in $facet stage cannot be empty
    seekingPipeline.push({$skip: skip});

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

      const result = await this.identityService
        .aggregate<PaginationResponse<Identity>>(pipeline)
        .next();

      return result.data.length ? result : {meta: {total: 0}, data: []};
    }
    return this.identityService.aggregate<Identity>([...pipeline, ...seekingPipeline]).toArray();
  }
  @Get("predefs")
  @UseGuards(AuthGuard())
  getPredefinedDefaults() {
    return this.identityService.getPredefinedDefaults();
  }

  @Get("factors")
  @UseGuards(AuthGuard())
  getFactors() {
    return this.twoFactorAuth.getSchemas();
  }

  @Get(":id")
  @UseGuards(
    AuthGuard(),
    ActionGuard(
      "passport:identity:show",
      undefined,
      registerPolicyAttacher("IdentityReadOnlyAccess")
    )
  )
  findOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.identityService.findOne({_id: id}, {projection: {password: 0}});
  }

  @Delete(":id/factors")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(
    AuthGuard(),
    ActionGuard("passport:identity:update", undefined, registerPolicyAttacher("IdentityFullAccess"))
  )
  async deleteFactor(@Param("id") id: string) {
    this.identityFactors.delete(id);

    this.twoFactorAuth.unregister(id);

    await this.identityService.findOneAndUpdate({_id: id}, {$unset: {authFactor: ""}});
  }

  @Get(":id/factors/start-verification")
  @UseGuards(
    AuthGuard(),
    ActionGuard("passport:identity:update", undefined, registerPolicyAttacher("IdentityFullAccess"))
  )
  async startFactorVerification(@Param("id") id: string, @Body() body: FactorMeta) {
    const factor = this.twoFactorAuth.getFactor(body);
    this.identityFactors.set(id, factor);

    // to keep this global value clear
    setTimeout(() => {
      this.identityFactors.delete(id);
    }, 1000 * 60);

    const message = factor.start();

    return {
      challenge: {
        message
      },
      answer: {
        url: `passport/identity/${id}/factors/complete-verification`,
        method: "POST",
        requiredFields: ["answer"]
      }
    };
  }

  @Post(":id/factors/complete-verification")
  @UseGuards(
    AuthGuard(),
    ActionGuard("passport:identity:update", undefined, registerPolicyAttacher("IdentityFullAccess"))
  )
  async completeFactorVerification(@Param("id", OBJECT_ID) id: ObjectId, @Body() {answer}: any) {
    const factor = this.identityFactors.get(id.toHexString());

    if (!factor) {
      throw new BadRequestException("Start a verification process before complete it.");
    }

    const isVerified = factor.authenticate(answer).catch(e => {
      throw new BadRequestException(e);
    });

    this.identityFactors.delete(id.toHexString());
    if (isVerified) {
      this.twoFactorAuth.register(id.toHexString(), factor);

      const meta = factor.getMeta();
      return this.identityService
        .findOneAndUpdate({_id: id}, {$set: {authFactor: meta}})
        .then(r => {
          return {
            message: "Created"
          };
        })
        .catch(e => {
          throw new InternalServerErrorException(e);
        });
    } else {
      throw new UnauthorizedException("Verification has been failed.");
    }
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
    delete identity.authFactor;

    return this.identityService
      .insertOne(identity)
      .then(insertedIdentity => this.afterIdentityUpdate(insertedIdentity))
      .catch(exception => {
        throw new BadRequestException(
          exception.code === 11000 ? "Identity already exists." : exception.message
        );
      });
  }

  private afterIdentityUpdate(identity: Identity) {
    delete identity.password;

    if (identity.authFactor) {
      this.twoFactorAuth.register(identity._id.toHexString(), identity.authFactor);

      delete identity.authFactor.secret;
    }

    return identity;
  }

  @UseInterceptors(activity(createIdentityActivity))
  @Put(":id")
  @UseGuards(
    AuthGuard(),
    ActionGuard("passport:identity:update", undefined, registerPolicyAttacher("IdentityFullAccess"))
  )
  async updateOne(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body(Schema.validate("http://spica.internal/passport/update-identity-with-attributes"))
    identity: Partial<Identity>
  ) {
    if (identity.password) {
      identity.password = await hash(identity.password);
    }
    return this.identityService
      .findOneAndUpdate({_id: id}, {$set: identity}, {returnOriginal: false})
      .then(updatedIdentity => this.afterIdentityUpdate(updatedIdentity))
      .catch(exception => {
        throw new BadRequestException(
          exception.code === 11000 ? "Identity already exists." : exception.message
        );
      });
  }

  @UseInterceptors(activity(createIdentityActivity))
  @Delete(":id")
  @UseGuards(AuthGuard(), ActionGuard("passport:identity:delete"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteOne(@Param("id", OBJECT_ID) id: ObjectId) {
    // prevent to delete the last user
    const userCount = await this.identityService.estimatedDocumentCount();
    if (userCount == 1) {
      return;
    }
    return this.identityService.deleteOne({_id: id});
  }

  @UseInterceptors(activity(createIdentityActivity))
  @Put(":id/policy/:policyId")
  @UseGuards(AuthGuard(), ActionGuard("passport:identity:policy:add"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async addPolicy(@Param("id", OBJECT_ID) id: ObjectId, @Param("policyId") policyId: string) {
    return this.identityService.findOneAndUpdate(
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
  @HttpCode(HttpStatus.NO_CONTENT)
  async removePolicy(@Param("id", OBJECT_ID) id: ObjectId, @Param("policyId") policyId: string) {
    return this.identityService.findOneAndUpdate(
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
