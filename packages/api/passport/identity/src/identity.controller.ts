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
  Optional,
  NotFoundException,
  Logger
} from "@nestjs/common";
import {activity} from "@spica-server/activity-services";
import {DEFAULT, NUMBER, JSONP, BOOLEAN} from "@spica-server/core";
import {Schema} from "@spica-server/core-schema";
import {DuplicateKeyError, ID} from "@spica-server/data";
import {COLLECTION_QUERY, CollectionQueryFacade, Id} from "@spica-server/interface-data";
import {ActionGuard, AuthGuard, ResourceFilter} from "@spica-server/passport-guard";
import {AuthFactor} from "@spica-server/passport-authfactor";
import {Factor, FactorMeta} from "@spica-server/interface-passport-authfactor";
import {createIdentityActivity} from "./activity.resource.js";
import {compare, hash} from "./hash.js";
import {IdentityService} from "./identity.service.js";
import {
  Identity,
  IDENTITY_OPTIONS,
  IDENTITY_REPOSITORY,
  IdentityOptions,
  IdentityRepository,
  PaginationResponse,
  POLICY_PROVIDER
} from "@spica-server/interface-passport-identity";
import {registerPolicyAttacher} from "./utility.js";
import {ClassCommander} from "@spica-server/replication";
import {CommandType} from "@spica-server/interface-replication";

const IDENTITY_COLLECTION = "identity";

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
    return this.identityFactors.delete(id);
  }

  constructor(
    private identityService: IdentityService,
    @Inject(IDENTITY_REPOSITORY) private identities: IdentityRepository,
    @Inject(IDENTITY_OPTIONS) private options: IdentityOptions,
    @Inject(POLICY_PROVIDER)
    private identityPolicyResolver: (req: any) => Promise<[{statement: []}]>,
    private authFactor: AuthFactor,
    @Inject(COLLECTION_QUERY) private queries: CollectionQueryFacade,
    @Optional() private commander: ClassCommander
  ) {
    if (this.commander) {
      this.commander.register(
        this,
        [this.setIdentityFactor, this.deleteIdentityFactor],
        CommandType.SYNC
      );
    }
    this.identities
      .findWithAuthFactor()
      .then(identities => {
        for (const identity of identities) {
          if (!identity.authFactor) {
            continue;
          }
          this.authFactor.register(identity._id.toString(), identity.authFactor);
        }
      })
      .catch(error => {
        Logger.error(
          `Failed to register persisted auth factors on startup: ${error}`,
          IdentityController.name
        );
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
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]))
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
    const expression: any = {password: 0, lastPasswords: 0};

    const authFactorSecretPaths = this.authFactor.getSecretPaths();
    authFactorSecretPaths.forEach(path => {
      expression[`authFactor.${path}`] = 0;
    });

    return expression;
  }

  @Get("profile")
  @UseGuards(
    AuthGuard(["IDENTITY", "APIKEY"]),
    ActionGuard("passport:identity:profile", "passport/identity")
  )
  async findProfileEntries(
    @Query("filter", JSONP) filter?: object,
    @Query("limit", NUMBER) limit?: number,
    @Query("skip", NUMBER) skip?: number,
    @Query("sort", JSONP) sort?: {[key: string]: 1 | -1}
  ) {
    return this.identities.profilerEntries({filter, limit, skip, sort});
  }

  @Get()
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("passport:identity:index"))
  async find(
    @Query("limit", DEFAULT(0), NUMBER) limit: number,
    @Query("skip", DEFAULT(0), NUMBER) skip: number,
    @Query("sort", JSONP) sort: {[path: string]: 1 | -1},
    @Query("paginate", DEFAULT(false), BOOLEAN) paginate: boolean,
    @Query("filter", JSONP) filter: object,
    @ResourceFilter({collection: IDENTITY_COLLECTION}) resourceFilter: object
  ) {
    const spec = {
      resourceFilter,
      filter,
      sort,
      skip,
      limit,
      fields: this.hideSecretsExpression()
    };

    if (paginate) {
      return this.queries.paginate<Identity>(
        "identity",
        spec,
        "estimate-unless-filtered"
      ) as Promise<PaginationResponse<Identity>>;
    }

    return this.queries.find<Identity>("identity", spec);
  }
  @Get("predefs")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]))
  getPredefinedDefaults() {
    return this.identityService.getPredefinedDefaults();
  }

  @Get("factors")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]))
  getFactors() {
    return this.authFactor.getSchemas();
  }

  @Delete(":id/factors")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(
    AuthGuard(["IDENTITY", "APIKEY"]),
    ActionGuard(
      "passport:identity:update",
      "passport/identity/:id",
      registerPolicyAttacher("IdentityFullAccess")
    )
  )
  async deleteFactor(@Param("id", ID(IDENTITY_COLLECTION)) id: Id) {
    // deleteIdentityFactor only clears any in-progress activation; an already-activated factor is
    // no longer in that transient map, so existence must be derived from the persisted record.
    this.deleteIdentityFactor(id.toString());
    this.authFactor.unregister(id.toString());

    const identity = await this.identities.removeAuthFactor(id);

    if (!identity) {
      throw new NotFoundException(`Identity with ID ${id} not found`);
    }
  }

  @Get(":id")
  @UseGuards(
    AuthGuard(["IDENTITY", "APIKEY"]),
    ActionGuard(
      "passport:identity:show",
      undefined,
      registerPolicyAttacher("IdentityReadOnlyAccess")
    )
  )
  async findOne(@Param("id", ID(IDENTITY_COLLECTION)) id: Id) {
    const identity = await this.identities.findById(id, this.hideSecretsExpression());
    if (!identity) {
      throw new NotFoundException(`Identity with ID ${id} not found.`);
    }
    return identity;
  }

  @Post(":id/start-factor-verification")
  @UseGuards(
    AuthGuard(["IDENTITY", "APIKEY"]),
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
    setTimeout(
      () => {
        this.deleteIdentityFactor(id);
      },
      1000 * 60 * 5
    );

    const challenge = await factor.start();

    return {
      challenge,
      answerUrl: `passport/identity/${id}/complete-factor-verification`
    };
  }

  @Post(":id/complete-factor-verification")
  @UseGuards(
    AuthGuard(["IDENTITY", "APIKEY"]),
    ActionGuard(
      "passport:identity:update",
      "passport/identity/:id",
      registerPolicyAttacher("IdentityFullAccess")
    )
  )
  async completeFactorVerification(
    @Param("id", ID(IDENTITY_COLLECTION)) id: Id,
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
    const factor = this.identityFactors.get(id.toString());

    if (!factor) {
      throw new BadRequestException("Start a factor verification before complete it.");
    }

    const isVerified = await factor.authenticate(answer).catch(e => {
      throw new BadRequestException(e);
    });

    this.deleteIdentityFactor(id.toString());

    if (!isVerified) {
      throw new UnauthorizedException("Verification has been failed.");
    }

    this.authFactor.register(id.toString(), factor.getMeta());

    const meta = factor.getMeta();
    return this.identities
      .setAuthFactor(id, meta)
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
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("passport:identity:create"))
  async insertOne(
    @Body(Schema.validate("http://spica.internal/passport/identity-create"))
    identity: Identity
  ) {
    identity.password = await hash(identity.password);
    identity.policies = [];
    identity.lastPasswords = [];

    return this.identities
      .insert(identity)
      .then(insertedIdentity => this.afterIdentityUpsert(insertedIdentity))
      .catch(exception => {
        throw new BadRequestException(
          exception instanceof DuplicateKeyError ? "Identity already exists." : exception.message
        );
      });
  }

  private afterIdentityUpsert(identity: Identity) {
    delete identity.password;
    delete identity.lastPasswords;

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
    AuthGuard(["IDENTITY", "APIKEY"]),
    ActionGuard("passport:identity:update", undefined, registerPolicyAttacher("IdentityFullAccess"))
  )
  async updateOne(
    @Param("id", ID(IDENTITY_COLLECTION)) id: Id,
    @Body(Schema.validate("http://spica.internal/passport/identity"))
    identity: Partial<Identity>
  ) {
    if (identity.password) {
      const {password: currentPassword, lastPasswords} = await this.identities.findByIdentifier(
        identity.identifier
      );

      const isEqual = await compare(identity.password, currentPassword);
      if (!isEqual) {
        identity.deactivateJwtsBefore = Date.now() / 1000;
      }

      if (this.options.passwordHistoryLimit > 0) {
        identity.lastPasswords = lastPasswords || [];

        identity.lastPasswords.push(currentPassword);

        if (identity.lastPasswords.length == this.options.passwordHistoryLimit + 1) {
          identity.lastPasswords.shift();
        }

        const isOneOfLastPasswords = (
          await Promise.all(identity.lastPasswords.map(oldPw => compare(identity.password, oldPw)))
        ).includes(true);

        if (isOneOfLastPasswords) {
          throw new BadRequestException(
            `New password can't be the one of last ${this.options.passwordHistoryLimit} passwords.`
          );
        }
      }

      identity.password = await hash(identity.password);
    }

    delete identity.authFactor;

    return this.identities
      .updateById(id, identity)
      .then(updatedIdentity => {
        if (!updatedIdentity) {
          throw new NotFoundException(`Identity with ID ${id} not found`);
        }
        return this.afterIdentityUpsert(updatedIdentity);
      })
      .catch(exception => {
        throw new BadRequestException(
          exception instanceof DuplicateKeyError ? "Identity already exists." : exception.message
        );
      });
  }

  @UseInterceptors(activity(createIdentityActivity))
  @Delete(":id")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("passport:identity:delete"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteOne(@Param("id", ID(IDENTITY_COLLECTION)) id: Id) {
    // prevent to delete the last user
    const userCount = await this.identities.estimatedCount();
    if (userCount == 1) {
      return;
    }

    return this.identities.deleteById(id).then(res => {
      if (!res) {
        throw new NotFoundException(`Identity with ID ${id} not found`);
      }
      if (this.authFactor.hasFactor(id.toString())) {
        this.authFactor.unregister(id.toString());
      }
    });
  }

  @UseInterceptors(activity(createIdentityActivity))
  @Put(":id/policy/:policyId")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("passport:identity:policy:add"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async addPolicy(
    @Param("id", ID(IDENTITY_COLLECTION)) id: Id,
    @Param("policyId") policyId: string
  ) {
    const res = await this.identities.addPolicy(id, policyId);
    if (!res) {
      throw new NotFoundException(`Identity with ID ${id} not found`);
    }
    return res;
  }

  @UseInterceptors(activity(createIdentityActivity))
  @Delete(":id/policy/:policyId")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("passport:identity:policy:remove"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async removePolicy(
    @Param("id", ID(IDENTITY_COLLECTION)) id: Id,
    @Param("policyId") policyId: string
  ) {
    const res = await this.identities.removePolicy(id, policyId);
    if (!res) {
      throw new NotFoundException(`Identity with ID ${id} not found`);
    }
    return res;
  }
}
