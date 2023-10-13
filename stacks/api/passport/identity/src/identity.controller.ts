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
  InternalServerErrorException,
  Optional
} from "@nestjs/common";
import {activity} from "@spica-server/activity/services";
import {DEFAULT, NUMBER, JSONP, BOOLEAN} from "@spica-server/core";
import {Schema} from "@spica-server/core/schema";
import {ObjectId, OBJECT_ID} from "@spica-server/database";
import {ActionGuard, AuthGuard, ResourceFilter} from "@spica-server/passport/guard";
import {Factor, FactorMeta, AuthFactor} from "@spica-server/passport/authfactor";
import {createIdentityActivity} from "./activity.resource";
import {hash} from "./hash";
import {IdentityService} from "./identity.service";
import {Identity, PaginationResponse} from "./interface";
import {POLICY_PROVIDER} from "./options";
import {registerPolicyAttacher} from "./utility";
import {ClassCommander, CommandType} from "@spica-server/replication";
import {PipelineBuilder} from "@spica-server/database/pipeline";

@Controller("passport/identity")
export class IdentityController {
  identityFactors = new Map<string, Factor>();

  setIdentityFactor(id, meta) {
    let factor: Factor;
    try {
      factor = this.authFactor.getFactor(meta);
    } catch (error) {
      throw new BadRequestException(error);
    }

    this.identityFactors.set(id, factor);
    return factor;
  }

  deleteIdentityFactor(id) {
    this.identityFactors.delete(id);
  }

  constructor(
    private identityService: IdentityService,
    @Inject(POLICY_PROVIDER)
    private identityPolicyResolver: (req: any) => Promise<[{statement: []}]>,
    private authFactor: AuthFactor,
    @Optional() private commander: ClassCommander
  ) {
    if (this.commander) {
      this.commander.register(this, [this.setIdentityFactor, this.deleteIdentityFactor],CommandType.SYNC);
    }
    this.identityService
      .find({
        authFactor: {$exists: true}
      })
      .then(identities => {
        for (const identity of identities) {
          this.authFactor.register(identity._id.toHexString(), identity.authFactor);
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

  private hideSecretsExpression(): {[key: string]: 0} {
    const expression: any = {password: 0};

    const authFactorSecretPaths = this.authFactor.getSecretPaths();
    authFactorSecretPaths.forEach(path => {
      expression[`authFactor.${path}`] = 0;
    });

    return expression;
  }

  @Get()
  @UseGuards(AuthGuard(), ActionGuard("passport:identity:index"))
  async find(
    @Query("limit", DEFAULT(0), NUMBER) limit: number,
    @Query("skip", DEFAULT(0), NUMBER) skip: number,
    @Query("sort", JSONP) sort: object,
    @Query("paginate", DEFAULT(false), BOOLEAN) paginate: boolean,
    @Query("filter", JSONP) filter: object,
    @ResourceFilter() resourceFilter: object
  ) {
    const pipelineBuilder = await new PipelineBuilder()
      .filterResources(resourceFilter)
      .filterByUserRequest(filter);

    const seekingPipeline = new PipelineBuilder()
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .setVisibilityOfFields(this.hideSecretsExpression())
      .result();

    const pipeline = (await pipelineBuilder.paginate(
      paginate,
      seekingPipeline,
      this.identityService.estimatedDocumentCount()
    )).result();

    if (paginate) {
      return this.identityService
        .aggregate<PaginationResponse<Identity>>(pipeline)
        .next()
        .then(r => {
          if (!r.data.length) {
            r.meta = {total: 0};
          }
          return r;
        });
    }

    return this.identityService.aggregate<Identity[]>([...pipeline, ...seekingPipeline]).toArray();
  }
  @Get("predefs")
  @UseGuards(AuthGuard())
  getPredefinedDefaults() {
    return this.identityService.getPredefinedDefaults();
  }

  @Get("factors")
  @UseGuards(AuthGuard())
  getFactors() {
    return this.authFactor.getSchemas();
  }

  @Delete(":id/factors")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(
    AuthGuard(),
    ActionGuard(
      "passport:identity:update",
      "passport/identity/:id",
      registerPolicyAttacher("IdentityFullAccess")
    )
  )
  async deleteFactor(@Param("id", OBJECT_ID) id: ObjectId) {
    this.deleteIdentityFactor(id.toHexString());

    this.authFactor.unregister(id.toHexString());

    await this.identityService.findOneAndUpdate({_id: id}, {$unset: {authFactor: ""}});
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
    return this.identityService.findOne({_id: id}, {projection: this.hideSecretsExpression()});
  }

  @Post(":id/start-factor-verification")
  @UseGuards(
    AuthGuard(),
    ActionGuard(
      "passport:identity:update",
      "passport/identity/:id",
      registerPolicyAttacher("IdentityFullAccess")
    )
  )
  async startFactorVerification(
    @Param("id") id: string,
    @Body(Schema.validate("http://spica.internal/passport/authfactor"))
    meta: FactorMeta
  ) {
    const factor = this.setIdentityFactor(id, meta);

    // to keep this global value clear
    setTimeout(() => {
      this.deleteIdentityFactor(id);
    }, 1000 * 60 * 5);

    const challenge = await factor.start();

    return {
      challenge,
      answerUrl: `passport/identity/${id}/complete-factor-verification`
    };
  }

  @Post(":id/complete-factor-verification")
  @UseGuards(
    AuthGuard(),
    ActionGuard(
      "passport:identity:update",
      "passport/identity/:id",
      registerPolicyAttacher("IdentityFullAccess")
    )
  )
  async completeFactorVerification(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body(
      Schema.validate({
        type: "object",
        required: ["answer"],
        properties: {
          answer: {
            type: "string"
          }
        },
        additionalProperties: false
      })
    )
    {answer}: {answer: string}
  ) {
    const factor = this.identityFactors.get(id.toHexString());

    if (!factor) {
      throw new BadRequestException("Start a factor verification before complete it.");
    }

    const isVerified = await factor.authenticate(answer).catch(e => {
      throw new BadRequestException(e);
    });

    this.deleteIdentityFactor(id.toHexString());

    if (!isVerified) {
      throw new UnauthorizedException("Verification has been failed.");
    }

    this.authFactor.register(id.toHexString(), factor.getMeta());

    const meta = factor.getMeta();
    return this.identityService
      .findOneAndUpdate({_id: id}, {$set: {authFactor: meta}})
      .then(() => {
        return {
          message: "Verification has been completed successfully."
        };
      })
      .catch(e => {
        throw new InternalServerErrorException(e);
      });
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

    return this.identityService
      .insertOne(identity)
      .then(insertedIdentity => this.afterIdentityUpsert(insertedIdentity))
      .catch(exception => {
        throw new BadRequestException(
          exception.code === 11000 ? "Identity already exists." : exception.message
        );
      });
  }

  private afterIdentityUpsert(identity: Identity) {
    delete identity.password;

    if (identity.authFactor) {
      this.authFactor.getSecretPaths().map(path => {
        delete identity.authFactor[path];
      });
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

    delete identity.authFactor;

    return this.identityService
      .findOneAndUpdate({_id: id}, {$set: identity}, {returnOriginal: false})
      .then(updatedIdentity => this.afterIdentityUpsert(updatedIdentity))
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

    return this.identityService.deleteOne({_id: id}).then(() => {
      if (this.authFactor.hasFactor(id.toHexString())) {
        this.authFactor.unregister(id.toHexString());
      }
    });
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
