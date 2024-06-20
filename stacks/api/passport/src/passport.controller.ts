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
  UseGuards,
  Headers
} from "@nestjs/common";
import {Identity, IdentityService, LoginCredentials} from "@spica-server/passport/identity";
import {RefreshTokenService} from "@spica-server/passport/refreshtoken";
import {Subject, throwError} from "rxjs";
import {catchError, take, timeout} from "rxjs/operators";
import {UrlEncodedBodyParser} from "./body";
import {StrategyService} from "./strategy/services/strategy.service";
import {NUMBER} from "@spica-server/core";
import {Schema} from "@spica-server/core/schema";
import {ObjectId, OBJECT_ID} from "@spica-server/database";
import {STRATEGIES} from "./options";
import {StrategyTypeServices} from "./strategy/interface";
import {AuthFactor} from "@spica-server/passport/authfactor";
import {ClassCommander, CommandType } from "@spica-server/replication";
import {AuthGuard} from "@spica-server/passport/guard";

/**
 * @name passport
 */
@Controller("passport")
export class PassportController {
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

  identityToken = new Map<string, any>();
  refreshTokenMap = new Map<string, any>();

  setIdentityToken(id, token) {
    this.identityToken.set(id, token);
  }

  deleteIdentityToken(id) {
    this.identityToken.delete(id);
  }

  setRefreshToken(id, token) {
    this.refreshTokenMap.set(id, token);
  }

  deleteRefreshToken(id) {
    this.refreshTokenMap.delete(id);
  }

  stateReqs = new Map<string, any>();

  constructor(
    private identityService: IdentityService,
    private refreshTokenService: RefreshTokenService,
    private strategyService: StrategyService,
    private authFactor: AuthFactor,
    @Inject(STRATEGIES) private strategyTypes: StrategyTypeServices,
    @Optional() private commander: ClassCommander
  ) {
    if (this.commander) {
      this.commander.register(
        this,
        [
          this.startIdentifyWithState,
          this.completeIdentifyWithState,
          this.setIdentityToken,
          this.deleteIdentityToken,
          this.setRefreshToken,
          this.deleteRefreshToken,
          this.setAssertObservers,
          this.deleteAssertObservers
        ],
        CommandType.SYNC
      );
    }
  }

  async getIdentity(identifier: string, password: string) {
    const identity = await this.identityService.identify(identifier, password);
    if (!identity) {
      throw new UnauthorizedException("Identifier or password was incorrect.");
    }
    return identity;
  }

  async startIdentifyWithState(state: string, expires: number) {
    let identity: Identity;

    if (!this.assertObservers.has(state)) {
      throw new BadRequestException("Authentication has failed due to invalid state.");
    }
    const observer = this.assertObservers.get(state);

    const {user} = await observer
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

    const idenfitifer = user ? user.upn || user.id || user.name_id || user.email : undefined;

    if (!idenfitifer) {
      throw new BadRequestException(
        "Response should include at least one of these values: upn, name_id, email, id."
      );
    }

    identity = await this.identityService.findOne({identifier: idenfitifer});

    // HQ sends attributes field which contains unacceptable fields for mongodb
    delete user.attributes;

    if (!identity) {
      identity = await this.identityService.insertOne({
        identifier: idenfitifer,
        password: undefined,
        policies: [],
        attributes: user,
        failedAttempts: [],
        lastLogin: undefined,
        lastPasswords: []
      });
    }

    this.completeIdentifyWithState(state, identity, expires);
  }

  async completeIdentifyWithState(state: string, identity: Identity, expires: number) {
    const res = this.stateReqs.get(state);
    this.stateReqs.delete(state);
    if (!res || res.headerSent) {
      return;
    }

    const { tokenSchema, refreshTokenSchema } = await this.signIdentity(identity, expires);
    this.setRefreshTokenToCookie(res, refreshTokenSchema.token)
    res.status(200).json(tokenSchema);
  }

  async signIdentity(identity: Identity, expiresIn?: number) {
    const tokenSchema = this.identityService.sign(identity, expiresIn);
    const refreshTokenSchema = await this.identityService.generateRefreshToken(identity);

    const id = identity._id.toHexString();
    if (this.authFactor.hasFactor(id)) {
      this.setIdentityToken(id, tokenSchema);
      this.setRefreshToken(id, refreshTokenSchema);
      setTimeout(() => {
        this.deleteIdentityToken(id)
        this.deleteRefreshToken(id)
      }, this.SESSION_TIMEOUT_MS);

      const challenge = await this.authFactor.start(id);
      const factorRes = {
        challenge,
        answerUrl: `passport/identify/${identity._id}/factor-authentication`
      }
      return { factorRes };
    } else {
      return { tokenSchema, refreshTokenSchema };
    }
  }

  async _identify(identifier: string, password: string, state: string, expires: number, res) {
    const catchError = e => {
      if (!res.headerSent) {
        res.status(e.status || 500).json(e.response || {message: e.message} || e);
      }
    };

    if (state) {
      this.stateReqs.set(state, res);
      setTimeout(() => this.stateReqs.delete(state), this.SESSION_TIMEOUT_MS);
      this.startIdentifyWithState(state, expires).catch(catchError);

      return;
    }

    const identity = await this.getIdentity(identifier, password).catch(catchError);
    if (!identity) {
      return;
    }

    const identifyResult = await this.signIdentity(identity, expires).catch(catchError);
    if(!identifyResult){
      return;
    }

    const {refreshTokenSchema, factorRes, tokenSchema} = identifyResult;
    if(factorRes){
      return res.status(200).json(factorRes)
    }

    this.setRefreshTokenToCookie(res, refreshTokenSchema.token)
    return res.status(200).json(tokenSchema);
  }

  setRefreshTokenToCookie(res: any, token: string){
    res.cookie('refreshToken', token, this.identityService.getCookieOptions());
  }

  @Post("identify")
  async identifyWithPost(
    @Body(Schema.validate("http://spica.internal/login"))
    {identifier, password, expires, state}: LoginCredentials,
    @Res() res: any,
    @Next() next
  ) {
    this._identify(identifier, password, state, expires, res);
  }

  @Post("identify/:id/factor-authentication")
  async authenticateWithFactor(@Param("id") id: string, @Body() body, @Res() res: any) {
    const hasFactor = this.authFactor.hasFactor(id);
    const token = this.identityToken.get(id);

    if (!hasFactor || !token) {
      throw new BadRequestException("Login with credentials session is not started or timeouted.");
    }

    if (Object.keys(body).indexOf("answer") == -1) {
      throw new BadRequestException("Body should include 'answer'.");
    }

    const {answer} = body;

    const isAuthenticated = await this.authFactor.authenticate(id, answer).catch(e => {
      this.deleteIdentityToken(id);
      this.deleteRefreshToken(id);
      throw new BadRequestException(e);
    });

    if (!isAuthenticated) {
      this.deleteIdentityToken(id);
      this.deleteRefreshToken(id);
      throw new UnauthorizedException();
    }

    const refreshTokenSchema = this.refreshTokenMap.get(id);
    this.setRefreshTokenToCookie(res, refreshTokenSchema.token)
    return res.status(200).json(this.identityToken.get(id));
  }

  @Get("access-token")
  @UseGuards(AuthGuard())
  async refreshToken(
    @Headers('authorization') accessToken: string,
    @Req() req: any,
    @Res() res: any,
  ) {
    const {refreshToken} = req.cookies;
    
    if (!refreshToken) {
      throw new UnauthorizedException("Refresh token does not exist.");
    }
    const identity = await this.identityService.verifyRefreshToken(accessToken, refreshToken);
    if(!identity){
      throw new UnauthorizedException("Invalid refresh token.");
    }

    const tokenSchema = this.identityService.sign(identity)
    res.status(200).json(tokenSchema);
  }

  @Get("strategies")
  async strategies() {
    return this.strategyService.aggregate([{$project: {options: 0}}]).toArray();
  }

  @Get("strategy/:id/url")
  async getUrl(@Param("id", OBJECT_ID) id: ObjectId) {
    const strategy = await this.strategyService.findOne({_id: id});

    if (!strategy) {
      throw new BadRequestException("Strategy does not exist.");
    }

    const service = this.strategyTypes.find(strategy.type);

    const login = await service.getLoginUrl(strategy);

    if (!login) {
      throw new InternalServerErrorException("Cannot generate login url.");
    }

    this.setAssertObservers(login.state);

    return login;
  }

  @Get("strategy/:name/metadata")
  @Header("Content-type", "application/xml")
  metadata(@Param("name") name: string) {
    return this.strategyTypes.find("saml").createMetadata(name);
  }

  @All("strategy/:id/complete")
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

    const service = this.strategyTypes.find(strategy.type);

    const observer = this.assertObservers.get(stateId);

    return service
      .assert(strategy, body, code)
      .then(identity => observer.next(identity))
      .catch(e => {
        observer.error(e.toString());
      });
  }
}
