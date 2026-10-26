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
  Res,
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
import {COLLECTION_QUERY, CollectionQueryFacade, Id, ReadSpec} from "@spica-server/interface-data";
import {ActionGuard, AuthGuard, ResourceFilter} from "@spica-server/passport-guard";
import {AuthFactor} from "@spica-server/passport-authfactor";
import {Factor, FactorMeta} from "@spica-server/interface-passport-authfactor";
import {createUserActivity} from "./activity.resource.js";
import {compare, hash} from "./hash.js";
import {UserService} from "./user.service.js";
import {
  User,
  USER_OPTIONS,
  USER_REPOSITORY,
  UserOptions,
  UserRepository,
  PaginationResponse,
  POLICY_PROVIDER,
  UserSelfUpdate,
  DecryptedUser
} from "@spica-server/interface-passport-user";
import {registerPolicyAttacher} from "./utility.js";
import {ClassCommander} from "@spica-server/replication";
import {CommandType} from "@spica-server/interface-replication";
import {VerificationService} from "./verification.service.js";
import {ProviderVerificationService} from "./services/provider.verification.service.js";
import {PasswordlessLoginService} from "./services/passwordless-login.service.js";
import {PasswordResetService} from "./services/password-reset.service.js";
import {replaceProviderFilter} from "./filter.js";
import {RateLimitGuard} from "./rate-limit.guard.js";

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
    @Inject(USER_REPOSITORY) private users: UserRepository,
    private verificationService: VerificationService,
    private providerVerificationService: ProviderVerificationService,
    private passwordlessLoginService: PasswordlessLoginService,
    private passwordResetService: PasswordResetService,
    @Inject(USER_OPTIONS) private options: UserOptions,
    private authFactor: AuthFactor,
    @Inject(COLLECTION_QUERY) private queries: CollectionQueryFacade,
    @Optional() private commander: ClassCommander
  ) {
    if (this.commander) {
      this.commander.register(this, [this.setUserFactor, this.deleteUserFactor], CommandType.SYNC);
    }
    this.users
      .findWithAuthFactor()
      .then(users => {
        for (const user of users) {
          if (!user.authFactor) {
            continue;
          }
          this.authFactor.register(user._id.toString(), user.authFactor);
        }
      })
      .catch(error => {
        Logger.error(
          `Failed to register persisted auth factors on startup: ${error}`,
          UserController.name
        );
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

  private providerFilterReplacer = async (filter: object) =>
    replaceProviderFilter(filter, value => this.userService.hashProviderValue(value));

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
    return this.users.profilerEntries({filter, limit, skip, sort});
  }

  @Get()
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("passport:user:index"))
  async find(
    @Query("limit", DEFAULT(0), NUMBER) limit: number,
    @Query("skip", DEFAULT(0), NUMBER) skip: number,
    @Query("sort", JSONP) sort: {[path: string]: 1 | -1},
    @Query("paginate", DEFAULT(false), BOOLEAN) paginate: boolean,
    @Query("filter", JSONP) filter: object,
    @ResourceFilter({collection: "user"}) resourceFilter: object
  ) {
    const spec: ReadSpec = {
      resourceFilter,
      filter,
      filterReplacers: [this.providerFilterReplacer],
      sort,
      skip,
      limit,
      fields: this.hideSecretsExpression()
    };

    if (paginate) {
      const paginatedResult = await this.queries.paginate<User>(
        "user",
        spec,
        "estimate-unless-filtered"
      );
      return {
        meta: paginatedResult.meta,
        data: paginatedResult.data.map(user => this.userService.decryptProviderFields(user))
      };
    }

    const users = await this.queries.find<User>("user", spec);

    return users.map(user => {
      return this.userService.decryptProviderFields(user);
    });
  }

  @Get("factors")
  @UseGuards(AuthGuard())
  getFactors() {
    return this.authFactor.getSchemas();
  }

  @Get("verify-magic-link")
  async verifyMagicLink(@Query("token") token: string) {
    if (!token) {
      throw new BadRequestException("Token query parameter is required.");
    }
    return this.providerVerificationService.validateCredentialsVerification(token, "MagicLink");
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
  async deleteFactor(@Param("id", ID("user")) id: Id) {
    // deleteUserFactor only clears any in-progress activation; an already-activated factor is
    // no longer in that transient map, so existence must be derived from the persisted record.
    this.deleteUserFactor(id.toString());
    this.authFactor.unregister(id.toString());

    const user = await this.users.removeAuthFactor(id);

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }

  @Get(":id")
  @UseGuards(
    AuthGuard(),
    ActionGuard("passport:user:show", undefined, registerPolicyAttacher("UserReadOnlyAccess"))
  )
  async findOne(@Param("id", ID("user")) id: Id) {
    const user = await this.queries.findOne<User>("user", {
      id,
      fields: this.hideSecretsExpression()
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return this.userService.decryptProviderFields(user);
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
    @Param("id", ID("user")) id: Id,
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
    const factor = this.userFactors.get(id.toString());

    if (!factor) {
      throw new BadRequestException("Start a factor verification before complete it.");
    }

    const isVerified = await factor.authenticate(answer).catch(e => {
      throw new BadRequestException(e);
    });

    this.deleteUserFactor(id.toString());

    if (!isVerified) {
      throw new UnauthorizedException("Verification has been failed.");
    }

    this.authFactor.register(id.toString(), factor.getMeta());

    const meta = factor.getMeta();
    return this.users
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

  @UseInterceptors(activity(createUserActivity))
  @Post()
  @UseGuards(
    AuthGuard(["IDENTITY", "APIKEY"]),
    ActionGuard("passport:user:create"),
    RateLimitGuard("createUser")
  )
  async insertOne(
    @Body(Schema.validate("http://spica.internal/passport/user-create"))
    user: User
  ) {
    user.password = await hash(user.password);
    user.policies = [];
    user.lastPasswords = [];

    return this.users
      .insert(user)
      .then(insertedUser => this.afterUserUpsert(insertedUser))
      .catch(exception => {
        throw new BadRequestException(
          exception instanceof DuplicateKeyError ? "User already exists." : exception.message
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

    return this.userService.decryptProviderFields(user);
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
    @Param("id", ID("user")) id: Id,
    @Body(Schema.validate("http://spica.internal/passport/user-self-update"))
    user: UserSelfUpdate
  ) {
    if (user.password) {
      const passwordUpdates = await this.userService.handlePasswordUpdate(id, user.password);
      Object.assign(user, passwordUpdates);
    }

    return this.users
      .updateById(id, user as Partial<User>)
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
    @Param("id", ID("user")) id: Id,
    @Body(Schema.validate("http://spica.internal/passport/user-update"))
    user: Pick<User, "username" | "password" | "bannedUntil" | "deactivateJwtsBefore">
  ) {
    if (user.password) {
      const passwordUpdates = await this.userService.handlePasswordUpdate(id, user.password);
      Object.assign(user, passwordUpdates);
    }

    return this.users
      .updateById(id, user)
      .then(updatedUser => {
        if (!updatedUser) {
          throw new NotFoundException(`User with ID ${id} not found`);
        }
        return this.afterUserUpsert(updatedUser);
      })
      .catch(exception => {
        throw new BadRequestException(
          exception instanceof DuplicateKeyError ? "User already exists." : exception.message
        );
      });
  }

  @UseInterceptors(activity(createUserActivity))
  @Delete(":id")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("passport:user:delete"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteOne(@Param("id", ID("user")) id: Id) {
    return this.users.deleteById(id).then(res => {
      if (!res) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }
      if (this.authFactor.hasFactor(id.toString())) {
        this.authFactor.unregister(id.toString());
      }
    });
  }

  @UseInterceptors(activity(createUserActivity))
  @Put(":id/policy/:policyId")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("passport:user:policy:add"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async addPolicy(@Param("id", ID("user")) id: Id, @Param("policyId") policyId: string) {
    const res = await this.users.addPolicy(id, policyId);
    if (!res) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return res;
  }

  @UseInterceptors(activity(createUserActivity))
  @Delete(":id/policy/:policyId")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("passport:user:policy:remove"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async removePolicy(@Param("id", ID("user")) id: Id, @Param("policyId") policyId: string) {
    const res = await this.users.removePolicy(id, policyId);
    if (!res) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return res;
  }

  @Post(":id/start-provider-verification")
  @UseGuards(
    RateLimitGuard("providerVerification"),
    AuthGuard(),
    ActionGuard("passport:user:update", "passport/user/:id")
  )
  startAuthProviderVerification(
    @Param("id", ID("user")) id: Id,
    @Body("value") value: string,
    @Body("provider") provider: string,
    @Body("strategy") strategy: "Otp" | "MagicLink",
    @Body("purpose") purpose: string
  ) {
    return this.providerVerificationService.startCredentialsVerification(
      id,
      value,
      strategy,
      provider,
      purpose
    );
  }

  @Post(":id/verify-provider")
  @UseGuards(
    RateLimitGuard("providerVerification"),
    AuthGuard(),
    ActionGuard("passport:user:update", "passport/user/:id")
  )
  async verifyProvider(
    @Param("id", ID("user")) id: Id,
    @Body("code") code: string,
    @Body("provider") provider: string,
    @Body("strategy") strategy: string,
    @Body("purpose") purpose: string
  ) {
    return this.providerVerificationService.validateCredentialsVerification(
      code,
      strategy,
      id,
      provider,
      purpose
    );
  }

  @Post("passwordless-login/start")
  @UseGuards(RateLimitGuard("login"))
  startPasswordlessLogin(
    @Body(Schema.validate("http://spica.internal/passport/passwordless-login-start"))
    body: {
      username: string;
      provider: "email" | "phone";
    }
  ) {
    return this.passwordlessLoginService.start(body.username, body.provider);
  }

  @Post("passwordless-login/verify")
  @UseGuards(RateLimitGuard("login"))
  async verifyPasswordlessLogin(
    @Body(Schema.validate("http://spica.internal/passport/passwordless-login-verify"))
    body: {
      username: string;
      code: string;
      provider: "email" | "phone";
    },
    @Res() res: any
  ) {
    const result = await this.passwordlessLoginService.verify(
      body.username,
      body.code,
      body.provider
    );
    const cookiePath = "passport/user/session/refresh";
    res.cookie(
      "refreshToken",
      result.refreshToken.token,
      this.userService.getCookieOptions(cookiePath)
    );
    return res.status(201).json(result.accessToken);
  }
  @Post("forgot-password/start")
  @UseGuards(RateLimitGuard("forgotPassword"))
  async startForgotPassword(
    @Body(Schema.validate("http://spica.internal/passport/forgot-password-start"))
    body: {
      username: string;
      provider: "email" | "phone";
    }
  ) {
    return this.passwordResetService.startForgotPasswordProcess(body.username, body.provider);
  }

  @Post("forgot-password/verify")
  @UseGuards(RateLimitGuard("forgotPassword"))
  async verifyForgotPassword(
    @Body(Schema.validate("http://spica.internal/passport/forgot-password-verify"))
    body: {
      username: string;
      code: string;
      newPassword: string;
      provider: "email" | "phone";
    }
  ) {
    return this.passwordResetService.verifyAndResetPassword(
      body.username,
      body.code,
      body.newPassword,
      body.provider
    );
  }
}
