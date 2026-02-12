import {
  BadRequestException,
  Body,
  Controller,
  GatewayTimeoutException,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Param,
  Post,
  Query,
  UnauthorizedException,
  UseInterceptors,
  Req,
  All,
  Inject,
  Res,
  Next,
  Optional,
  Headers
} from "@nestjs/common";
import {UserService} from "@spica-server/passport/user";
import {User, LoginCredentials} from "@spica-server/interface/passport/user";
import {Subject, throwError} from "rxjs";
import {catchError, take, timeout} from "rxjs/operators";
import {UrlEncodedBodyParser} from "./body";
import {StrategyService} from "./strategy/services/strategy.service";
import {NUMBER} from "@spica-server/core";
import {Schema} from "@spica-server/core/schema";
import {ObjectId, OBJECT_ID} from "@spica-server/database";
import {STRATEGIES, StrategyTypeServices} from "@spica-server/interface/passport";
import {AuthFactor} from "@spica-server/passport/authfactor";
import {ClassCommander} from "@spica-server/replication";
import {CommandType} from "@spica-server/interface/replication";

/**
 * @name passport
 */
@Controller("passport")
export class PassportUserController {
  readonly SESSION_TIMEOUT_MS = 60 * 1000;
  assertObservers = new Map<string, Subject<any>>();

  setAssertObservers(id) {
    const subject = new Subject();
    this.assertObservers.set(id, subject);
    return subject;
  }

  deleteAssertObservers(id) {
    this.assertObservers.delete(id);
  }

  userToken = new Map<string, any>();
  refreshTokenMap = new Map<string, any>();

  setUserToken(id, token) {
    this.userToken.set(id, token);
  }

  deleteUserToken(id) {
    this.userToken.delete(id);
  }

  setRefreshToken(id, token) {
    this.refreshTokenMap.set(id, token);
  }

  deleteRefreshToken(id) {
    this.refreshTokenMap.delete(id);
  }

  setRefreshTokenCookie(res: any, token: string) {
    const path = "passport/session/refresh";
    res.cookie("refreshToken", token, this.userService.getCookieOptions(path));
  }

  stateReqs = new Map<string, any>();

  constructor(
    private userService: UserService,
    private strategyService: StrategyService,
    private authFactor: AuthFactor,
    @Inject(STRATEGIES) private strategyTypes: StrategyTypeServices,
    @Optional() private commander: ClassCommander
  ) {
    if (this.commander) {
      this.commander.register(
        this,
        [
          this.startLoginWithState,
          this.completeLoginWithState,
          this.setUserToken,
          this.deleteUserToken,
          this.setRefreshToken,
          this.deleteRefreshToken,
          this.setAssertObservers,
          this.deleteAssertObservers
        ],
        CommandType.SYNC
      );
    }
  }

  async getUser(username: string, password: string) {
    const user = await this.userService.login(username, password);
    if (!user) {
      throw new UnauthorizedException("Username or password was incorrect.");
    }
    return user;
  }

  async startLoginWithState(state: string, expires: number) {
    let user: User;

    if (!this.assertObservers.has(state)) {
      throw new BadRequestException("Authentication has failed due to invalid state.");
    }
    const observer = this.assertObservers.get(state);

    const {user: userData} = await observer
      .pipe(
        timeout(this.SESSION_TIMEOUT_MS),
        take(1),
        catchError(error => {
          this.deleteAssertObservers(state);
          return throwError(
            error && error.name == "TimeoutError"
              ? new GatewayTimeoutException(
                  `Operation did not complete within ${this.SESSION_TIMEOUT_MS / 1000} seconds.`
                )
              : new UnauthorizedException(JSON.stringify(error))
          );
        })
      )
      .toPromise();
    this.deleteAssertObservers(state);

    const username = userData
      ? userData.upn || userData.id || userData.name_id || userData.email
      : undefined;

    if (!username) {
      throw new BadRequestException(
        "Response should include at least one of these values: upn, name_id, email, id."
      );
    }

    user = await this.userService.findOne({username: username});

    if (!user) {
      user = await this.userService.insertOne({
        username: username,
        password: undefined,
        policies: [],
        lastPasswords: [],
        failedAttempts: [],
        lastLogin: undefined
      });
    }

    this.completeLoginWithState(state, user, expires);
  }

  async completeLoginWithState(state: string, user: User, expires: number) {
    const res = this.stateReqs.get(state);
    this.stateReqs.delete(state);
    if (!res || res.headerSent) {
      return;
    }

    const {tokenSchema, refreshTokenSchema} = await this.signUser(user, expires);
    this.setRefreshTokenCookie(res, refreshTokenSchema.token);
    res.status(200).json(tokenSchema);
  }

  async signUser(user: User, expiresIn: number) {
    const tokenSchema = this.userService.sign(user, expiresIn);
    const refreshTokenSchema = await this.userService.signRefreshToken(user);

    const id = user._id.toHexString();
    if (this.authFactor.hasFactor(id)) {
      this.setUserToken(id, tokenSchema);
      this.setRefreshToken(id, refreshTokenSchema);

      setTimeout(() => {
        this.deleteUserToken(id);
        this.deleteRefreshToken(id);
      }, this.SESSION_TIMEOUT_MS);

      const challenge = await this.authFactor.start(id);
      const factorRes = {
        challenge,
        answerUrl: `passport/login/${user._id}/factor-authentication`
      };
      return {factorRes};
    } else {
      return {tokenSchema, refreshTokenSchema};
    }
  }

  async _login(username: string, password: string, state: string, expires: number, res) {
    const catchError = e => {
      if (!res.headerSent) {
        res.status(e.status || 500).json(e.response || e);
      }
    };

    if (state) {
      this.stateReqs.set(state, res);
      setTimeout(() => this.stateReqs.delete(state), this.SESSION_TIMEOUT_MS);

      this.startLoginWithState(state, expires).catch(catchError);

      return;
    }

    const user = await this.getUser(username, password).catch(catchError);
    if (!user) {
      return;
    }

    const loginResult = await this.signUser(user, expires).catch(catchError);
    if (!loginResult) {
      return;
    }

    const {refreshTokenSchema, factorRes, tokenSchema} = loginResult;
    if (factorRes) {
      return res.status(200).json(factorRes);
    }

    this.setRefreshTokenCookie(res, refreshTokenSchema.token);
    return res.status(200).json(tokenSchema);
  }

  @Get("login")
  async login(
    @Query("username") username: string,
    @Query("password") password: string,
    @Query("state") state: string,
    @Req() req: any,
    @Next() next,
    @Query("expires", NUMBER) expires?: number
  ) {
    req.res.append(
      "Warning",
      `299 "Login with 'GET' method has been deprecated. Use 'POST' instead."`
    );
    this._login(username, password, state, expires, req.res);
  }

  @Post("login")
  async loginWithPost(
    @Body(Schema.validate("http://spica.internal/login"))
    {username, password, expires, state}: LoginCredentials,
    @Res() res: any,
    @Next() next
  ) {
    this._login(username, password, state, expires, res);
  }

  @Post("login/:id/factor-authentication")
  async authenticateWithFactor(@Param("id") id: string, @Body() body, @Res() res) {
    const hasFactor = this.authFactor.hasFactor(id);
    const token = this.userToken.get(id);

    if (!hasFactor || !token) {
      throw new BadRequestException("Login with credentials session is not started or timeouted.");
    }

    if (Object.keys(body).indexOf("answer") == -1) {
      throw new BadRequestException("Body should include 'answer'.");
    }

    const {answer} = body;

    const isAuthenticated = await this.authFactor.authenticate(id, answer).catch(e => {
      this.deleteUserToken(id);
      this.deleteRefreshToken(id);
      throw new BadRequestException(e);
    });

    if (!isAuthenticated) {
      this.deleteUserToken(id);
      this.deleteRefreshToken(id);

      throw new UnauthorizedException();
    }

    const refreshTokenSchema = this.refreshTokenMap.get(id);
    this.setRefreshTokenCookie(res, refreshTokenSchema.token);
    return res.status(200).json(this.userToken.get(id));
  }

  @Post("user/session/refresh")
  async refreshToken(
    @Headers("authorization") accessToken: string,
    @Req() req: any,
    @Res() res: any
  ) {
    const {refreshToken} = req.cookies || {};

    if (!refreshToken) {
      throw new UnauthorizedException("Refresh token does not exist.");
    }

    let tokenSchema;
    try {
      tokenSchema = await this.userService.refreshToken(accessToken, refreshToken);
    } catch (error) {
      throw new BadRequestException(error);
    }
    res.status(200).json(tokenSchema);
  }

  @Get("user/strategies")
  async strategies() {
    return this.strategyService
      .aggregate([{$match: {type: "oauth"}}, {$project: {options: 0}}])
      .toArray();
  }

  @Get("user/strategy/:id/url")
  async getUrl(@Param("id", OBJECT_ID) id: ObjectId) {
    const strategy = await this.strategyService.findOne({_id: id});

    if (!strategy) {
      throw new BadRequestException("Strategy does not exist.");
    }

    if (strategy.type !== "oauth") {
      throw new BadRequestException("Strategy type is not supported for users.");
    }

    const service = this.strategyTypes.find(strategy.type, strategy.options.idp);

    const login = await service.getLoginUrl(strategy);

    if (!login) {
      throw new InternalServerErrorException("Cannot generate login url.");
    }

    this.setAssertObservers(login.state);

    return login;
  }

  @All("user/strategy/:id/complete")
  @UseInterceptors(UrlEncodedBodyParser())
  @HttpCode(HttpStatus.NO_CONTENT)
  async complete(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body() body: unknown,
    @Query("state") stateId: string,
    @Query("code") code: string
  ) {
    if (!stateId) {
      throw new BadRequestException("state query parameter is required.");
    }

    if (!this.assertObservers.has(stateId)) {
      throw new BadRequestException("Authentication has failed due to invalid state.");
    }

    const strategy = await this.strategyService.findOne({_id: id});

    if (!strategy) {
      throw new BadRequestException("Strategy does not exist.");
    }

    if (strategy.type !== "oauth") {
      throw new BadRequestException("Strategy type is not supported for users.");
    }

    const service = this.strategyTypes.find(strategy.type, strategy.options.idp);

    const observer = this.assertObservers.get(stateId);

    return service
      .assert(strategy, body, code)
      .then(user => observer.next(user))
      .catch(e => {
        observer.error(e.toString());
      });
  }
}
