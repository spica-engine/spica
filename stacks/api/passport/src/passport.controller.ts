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
  Res
} from "@nestjs/common";
import {Identity, IdentityService, LoginCredentials} from "@spica-server/passport/identity";
import {Subject, throwError} from "rxjs";
import {catchError, take, timeout} from "rxjs/operators";
import {UrlEncodedBodyParser} from "./body";
import {StrategyService} from "./strategy/services/strategy.service";
import {NUMBER} from "@spica-server/core";
import {Schema} from "@spica-server/core/schema";
import {ObjectId, OBJECT_ID} from "@spica-server/database";
import {STRATEGIES} from "./options";
import {StrategyTypeServices} from "./strategy/interface";
import {TwoFactorAuth} from "@spica-server/passport/twofactorauth";

/**
 * @name passport
 */
@Controller("passport")
export class PassportController {
  assertObservers = new Map<string, Subject<any>>();
  identityToken = new Map<string, any>();

  constructor(
    private identityService: IdentityService,
    private strategyService: StrategyService,
    private twoFactorAuth: TwoFactorAuth,
    @Inject(STRATEGIES) private strategyTypes: StrategyTypeServices
  ) {}

  async _identify(identifier: string, password: string, state: string, expiresIn: number, res) {
    let identity: Identity;

    if (!state) {
      identity = await this.identityService.identify(identifier, password);
      if (!identity) {
        throw new UnauthorizedException("Identifier or password was incorrect.");
      }
    } else {
      if (!this.assertObservers.has(state)) {
        throw new BadRequestException("Authentication has failed due to invalid state.");
      }

      const observer = this.assertObservers.get(state);

      const {user} = await observer
        .pipe(
          timeout(60000),
          take(1),
          catchError(error => {
            this.assertObservers.delete(state);
            return throwError(
              error && error.name == "TimeoutError"
                ? new GatewayTimeoutException("Operation did not complete within one minute.")
                : new UnauthorizedException(JSON.stringify(error))
            );
          })
        )
        .toPromise();
      this.assertObservers.delete(state);

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
          attributes: user
        });
      }
    }

    const tokenSchema = this.identityService.sign(identity, expiresIn);

    if (this.twoFactorAuth.hasFactor(identity._id.toHexString())) {
      this.identityToken.set(identity._id.toHexString(), tokenSchema);

      res.status(200).json({
        challenge: {
          url: `passport/identify/${identity._id}/factor-authentication`,
          method: "GET"
        }
      });
    } else {
      res.status(200).json(tokenSchema);
    }
  }

  @Get("identify/:id/factor-authentication")
  async getFactor(@Param("id") id: string) {
    const hasFactor = this.twoFactorAuth.hasFactor(id);
    const token = this.identityToken.get(id);

    if (!hasFactor || !token) {
      throw new BadRequestException("Login with credentials process should be started first.");
    }

    const message = await this.twoFactorAuth.start(id);

    return {
      challenge: {
        message
      },
      answer: {
        url: `passport/identify/${id}/factor-authentication`,
        method: "POST"
      }
    };
  }

  @Get("identify")
  identify(
    @Query("identifier") identifier: string,
    @Query("password") password: string,
    @Query("state") state: string,
    @Req() req: any,
    @Query("expires", NUMBER) expiresIn?: number
  ) {
    req.res.append(
      "Warning",
      `299 "Identify with 'GET' method has been deprecated. Use 'POST' instead."`
    );

    return this._identify(identifier, password, state, expiresIn, req.res);
  }

  @Post("identify")
  identifyWithPost(
    @Body(Schema.validate("http://spica.internal/login")) credentials: LoginCredentials,
    @Res() res: any
  ) {
    return this._identify(
      credentials.identifier,
      credentials.password,
      credentials.state,
      credentials.expires,
      res
    );
  }

  @Post("identify/:id/factor-authentication")
  async authenticateWithFactor(@Param("id") id: string, @Body() body) {
    const hasFactor = this.twoFactorAuth.hasFactor(id);
    const token = this.identityToken.get(id);

    if (!hasFactor || !token) {
      throw new BadRequestException("Login with credentials process should be started first.");
    }

    if (Object.keys(body).indexOf("answer") == -1) {
      throw new BadRequestException("Body should include 'answer'.");
    }

    const {answer} = body;

    const isAuthenticated = await this.twoFactorAuth.authenticate(id, answer).catch(e => {
      this.identityToken.delete(id);
      throw new BadRequestException(e);
    });

    if (!isAuthenticated) {
      this.identityToken.delete(id);
      throw new UnauthorizedException();
    }

    return this.identityToken.get(id);
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

    const observer = new Subject();

    this.assertObservers.set(login.state, observer);

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
        console.log(e);
        observer.error(e.toString());
      });
  }
}
