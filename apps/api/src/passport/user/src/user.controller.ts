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
  NotFoundException
} from "@nestjs/common";
import {activity} from "@spica-server/activity/services";
import {DEFAULT, NUMBER, JSONP, BOOLEAN} from "@spica-server/core";
import {Schema} from "@spica-server/core/schema";
import {ObjectId, OBJECT_ID, ReturnDocument} from "@spica-server/database";
import {ActionGuard, AuthGuard, ResourceFilter} from "@spica-server/passport/guard";
import {AuthFactor} from "@spica-server/passport/authfactor";
import {Factor, FactorMeta} from "@spica-server/interface/passport/authfactor";
import {createUserActivity} from "./activity.resource";
import {compare, hash} from "./hash";
import {UserService} from "./user.service";
import {
  User,
  USER_OPTIONS,
  UserOptions,
  PaginationResponse,
  POLICY_PROVIDER
} from "@spica-server/interface/passport/user";
import {registerPolicyAttacher} from "./utility";
import {ClassCommander} from "@spica-server/replication";
import {CommandType} from "@spica-server/interface/replication";
import {PipelineBuilder} from "@spica-server/database/pipeline";
import {VerificationService} from "./verification.service";

@Controller("passport/user")
export class UserController {
  userFactors = new Map<string, Factor>();

  setUserFactor(id, meta) {
    let factor: Factor;
    try {
      factor = this.authFactor.getFactor(meta);
    } catch (error) {
      throw new BadRequestException(error);
    }

    this.userFactors.set(id, factor);
    return factor;
  }

  deleteUserFactor(id) {
    return this.userFactors.delete(id);
  }

  constructor(
    private userService: UserService,
    private verificationService: VerificationService,
    @Inject(USER_OPTIONS) private options: UserOptions,
    private authFactor: AuthFactor,
    @Optional() private commander: ClassCommander
  ) {
    if (this.commander) {
      this.commander.register(this, [this.setUserFactor, this.deleteUserFactor], CommandType.SYNC);
    }
    this.userService
      .find({
        authFactor: {$exists: true}
      })
      .then(users => {
        for (const user of users) {
          this.authFactor.register(user._id.toHexString(), user.authFactor);
        }
      });
  }

  @Get("verify")
  verify(@Headers("Authorization") token: string) {
    if (!token) {
      throw new BadRequestException("Authorization header is missing.");
    }

    return this.userService.verify(token).catch(e => {
      throw new BadRequestException(e.message);
    });
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
    ActionGuard("passport:user:profile", "passport/user")
  )
  async findProfileEntries(
    @Query("filter", JSONP) filter?: object,
    @Query("limit", NUMBER) limit?: number,
    @Query("skip", NUMBER) skip?: number,
    @Query("sort", JSONP) sort?: {[key: string]: 1 | -1}
  ) {
    const cursor = this.userService.findOnProfiler(filter);

    if (limit) {
      cursor.limit(limit);
    }

    if (skip) {
      cursor.skip(skip);
    }

    if (sort) {
      cursor.sort(sort);
    }

    return cursor.toArray();
  }

  @Get()
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("passport:user:index"))
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

    const pipeline = (
      await pipelineBuilder.paginate(
        paginate,
        seekingPipeline,
        this.userService.estimatedDocumentCount()
      )
    ).result();

    if (paginate) {
      return this.userService
        .aggregate<PaginationResponse<User>>(pipeline)
        .next()
        .then(r => {
          if (!r.data.length) {
            r.meta = {total: 0};
          }
          return r;
        });
    }

    return this.userService.aggregate<User[]>([...pipeline, ...seekingPipeline]).toArray();
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
      "passport:user:update",
      "passport/user/:id",
      registerPolicyAttacher("UserFullAccess")
    )
  )
  async deleteFactor(@Param("id", OBJECT_ID) id: ObjectId) {
    const res = this.deleteUserFactor(id.toHexString());
    this.authFactor.unregister(id.toHexString());

    if (!res) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    await this.userService.findOneAndUpdate({_id: id}, {$unset: {authFactor: ""}});
  }

  @Get(":id")
  @UseGuards(
    AuthGuard(),
    ActionGuard("passport:user:show", undefined, registerPolicyAttacher("UserReadOnlyAccess"))
  )
  findOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.userService.findOne({_id: id}, {projection: this.hideSecretsExpression()});
  }

  @Post(":id/start-factor-verification")
  @UseGuards(
    AuthGuard(),
    ActionGuard(
      "passport:user:update",
      "passport/user/:id",
      registerPolicyAttacher("UserFullAccess")
    )
  )
  async startFactorVerification(
    @Param("id") id: string,
    @Body(Schema.validate("http://spica.internal/passport/authfactor"))
    meta: FactorMeta
  ) {
    const factor = this.setUserFactor(id, meta);

    // to keep this global value clear
    setTimeout(
      () => {
        this.deleteUserFactor(id);
      },
      1000 * 60 * 5
    );

    const challenge = await factor.start();

    return {
      challenge,
      answerUrl: `passport/user/${id}/complete-factor-verification`
    };
  }

  @Post(":id/complete-factor-verification")
  @UseGuards(
    AuthGuard(),
    ActionGuard(
      "passport:user:update",
      "passport/user/:id",
      registerPolicyAttacher("UserFullAccess")
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
    const factor = this.userFactors.get(id.toHexString());

    if (!factor) {
      throw new BadRequestException("Start a factor verification before complete it.");
    }

    const isVerified = await factor.authenticate(answer).catch(e => {
      throw new BadRequestException(e);
    });

    this.deleteUserFactor(id.toHexString());

    if (!isVerified) {
      throw new UnauthorizedException("Verification has been failed.");
    }

    this.authFactor.register(id.toHexString(), factor.getMeta());

    const meta = factor.getMeta();
    return this.userService
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

  @UseInterceptors(activity(createUserActivity))
  @Post()
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("passport:user:create"))
  async insertOne(
    @Body(Schema.validate("http://spica.internal/passport/create-user-with-attributes"))
    user: User
  ) {
    user.password = await hash(user.password);
    user.policies = [];
    user.lastPasswords = [];

    return this.userService
      .insertOne(user)
      .then(insertedUser => this.afterUserUpsert(insertedUser))
      .catch(exception => {
        throw new BadRequestException(
          exception.code === 11000 ? "User already exists." : exception.message
        );
      });
  }

  private afterUserUpsert(user: User) {
    delete user.password;
    delete user.lastPasswords;

    if (user.authFactor) {
      this.authFactor.getSecretPaths().map(path => {
        delete user.authFactor[path];
      });
    }

    return user;
  }

  @UseInterceptors(activity(createUserActivity))
  @Put(":id/self")
  @UseGuards(
    AuthGuard(),
    ActionGuard(
      "passport:user:update",
      "passport/user/:id",
      registerPolicyAttacher("UserFullAccess")
    )
  )
  async updateSelf(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body(Schema.validate("http://spica.internal/passport/user-self-update-with-attributes"))
    user: Partial<User>
  ) {
    if (user.password) {
      const passwordUpdates = await this.handlePasswordUpdate(id, user.password);
      Object.assign(user, passwordUpdates);
    }

    delete user.authFactor;

    return this.userService
      .findOneAndUpdate({_id: id}, {$set: user}, {returnDocument: ReturnDocument.AFTER})
      .then(updatedUser => {
        if (!updatedUser) {
          throw new NotFoundException(`User with ID ${id} not found`);
        }
        return this.afterUserUpsert(updatedUser);
      })
      .catch(exception => {
        throw new BadRequestException(exception.message);
      });
  }

  @UseInterceptors(activity(createUserActivity))
  @Put(":id")
  @UseGuards(
    AuthGuard(["IDENTITY", "APIKEY"]),
    ActionGuard("passport:user:update", undefined, registerPolicyAttacher("UserFullAccess"))
  )
  async updateOne(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body(Schema.validate("http://spica.internal/passport/user-update-with-attributes"))
    user: Partial<User>
  ) {
    if (user.password) {
      const passwordUpdates = await this.handlePasswordUpdate(id, user.password);
      Object.assign(user, passwordUpdates);
    }

    delete user.authFactor;

    return this.userService
      .findOneAndUpdate({_id: id}, {$set: user}, {returnDocument: ReturnDocument.AFTER})
      .then(updatedUser => {
        if (!updatedUser) {
          throw new NotFoundException(`User with ID ${id} not found`);
        }
        return this.afterUserUpsert(updatedUser);
      })
      .catch(exception => {
        throw new BadRequestException(
          exception.code === 11000 ? "User already exists." : exception.message
        );
      });
  }

  @UseInterceptors(activity(createUserActivity))
  @Delete(":id")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("passport:user:delete"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteOne(@Param("id", OBJECT_ID) id: ObjectId) {
    // prevent to delete the last user
    const userCount = await this.userService.estimatedDocumentCount();
    if (userCount == 1) {
      return;
    }

    return this.userService.deleteOne({_id: id}).then(res => {
      if (!res) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }
      if (this.authFactor.hasFactor(id.toHexString())) {
        this.authFactor.unregister(id.toHexString());
      }
    });
  }

  @UseInterceptors(activity(createUserActivity))
  @Put(":id/policy/:policyId")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("passport:user:policy:add"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async addPolicy(@Param("id", OBJECT_ID) id: ObjectId, @Param("policyId") policyId: string) {
    const res = await this.userService.findOneAndUpdate(
      {
        _id: id
      },
      {
        $addToSet: {policies: policyId}
      },
      {
        returnDocument: ReturnDocument.AFTER,
        projection: {password: 0, lastPasswords: 0}
      }
    );
    if (!res) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return res;
  }

  @UseInterceptors(activity(createUserActivity))
  @Delete(":id/policy/:policyId")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("passport:user:policy:remove"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async removePolicy(@Param("id", OBJECT_ID) id: ObjectId, @Param("policyId") policyId: string) {
    const res = await this.userService.findOneAndUpdate(
      {
        _id: id
      },
      {
        $pull: {policies: policyId}
      },
      {
        returnDocument: ReturnDocument.AFTER,
        projection: {password: 0, lastPasswords: 0}
      }
    );
    if (!res) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return res;
  }

  @Post(":id/start-provider-verification")
  @UseGuards(AuthGuard(), ActionGuard("passport:user:update", "passport/user/:id"))
  startAuthProviderVerification(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body("value") value: string,
    @Body("provider") provider: string
  ) {
    return this.verificationService.startAuthProviderVerification(id, value, provider);
  }

  @Post(":id/verify-provider")
  @UseGuards(AuthGuard(), ActionGuard("passport:user:update", "passport/user/:id"))
  async verifyProvider(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body("code") code: string,
    @Body("provider") provider: string
  ) {
    return this.verificationService.verifyAuthProvider(id, code, provider);
  }

  private async handlePasswordUpdate(
    id: ObjectId,
    newPassword: string
  ): Promise<{password: string; deactivateJwtsBefore?: number; lastPasswords?: string[]}> {
    const {password: currentPassword, lastPasswords} = await this.userService.findOne({_id: id});

    const isEqual = await compare(newPassword, currentPassword);
    const updates: any = {};

    if (!isEqual) {
      updates.deactivateJwtsBefore = Date.now() / 1000;
    }

    if (this.options.passwordHistoryLimit > 0) {
      updates.lastPasswords = lastPasswords || [];
      updates.lastPasswords.push(currentPassword);

      if (updates.lastPasswords.length === this.options.passwordHistoryLimit + 1) {
        updates.lastPasswords.shift();
      }

      const isOneOfLastPasswords = (
        await Promise.all(updates.lastPasswords.map(oldPw => compare(newPassword, oldPw)))
      ).includes(true);

      if (isOneOfLastPasswords) {
        throw new BadRequestException(
          `New password can't be the one of last ${this.options.passwordHistoryLimit} passwords.`
        );
      }
    }

    updates.password = await hash(newPassword);

    return updates;
  }
}
