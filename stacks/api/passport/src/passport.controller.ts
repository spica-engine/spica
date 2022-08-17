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
import {AuthFactor} from "@spica-server/passport/authfactor";
import {ClassCommander, ReplicationMap} from "@spica-server/replication";

/**
 * @name passport
 */
@Controller("passport")
export class PassportController {
  assertObservers = new ReplicationMap<string, Subject<any>>(
    this.commander,
    `${this.constructor.name}.assertObservers`
  );

  identityToken = new ReplicationMap<string, any>(
    this.commander,
    `${this.constructor.name}.identityToken`
  );

  constructor(
    private identityService: IdentityService,
    private strategyService: StrategyService,
    private authFactor: AuthFactor,
    private commander: ClassCommander,
    @Inject(STRATEGIES) private strategyTypes: StrategyTypeServices
  ) {
    commander.register(this);
  }

  async _identify(
    identifier: string,
    password: string,
    state: string,
    expiresIn: number
  ): Promise<object> {
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

    if (this.authFactor.hasFactor(identity._id.toHexString())) {
      this.identityToken.set(identity._id.toHexString(), tokenSchema);

      const challenge = await this.authFactor.start(identity._id.toHexString());

      return {challenge, answerUrl: `passport/identify/${identity._id}/factor-authentication`};
    } else {
      return tokenSchema;
    }
  }

  @Get("identify")
  async identify(
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

    this.emitCommand("_identify", [identifier, password, state, expiresIn]);
    const body = await this._identify(identifier, password, state, expiresIn);
    return req.res.status(200).json(body);
  }

  @Post("identify")
  async identifyWithPost(
    @Body(Schema.validate("http://spica.internal/login")) credentials: LoginCredentials,
    @Res() res: any
  ) {
    this.emitCommand("_identify", [
      credentials.identifier,
      credentials.password,
      credentials.state,
      credentials.expires
    ]);
    const body = await this._identify(
      credentials.identifier,
      credentials.password,
      credentials.state,
      credentials.expires
    );

    return res.status(200).send(body);
  }

  @Post("identify/:id/factor-authentication")
  async authenticateWithFactor(@Param("id") id: string, @Body() body) {
    const hasFactor = this.authFactor.hasFactor(id);
    const token = this.identityToken.get(id);

    if (!hasFactor || !token) {
      throw new BadRequestException("Login with credentials process should be started first.");
    }

    if (Object.keys(body).indexOf("answer") == -1) {
      throw new BadRequestException("Body should include 'answer'.");
    }

    const {answer} = body;

    const isAuthenticated = await this.authFactor.authenticate(id, answer).catch(e => {
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
        observer.error(e.toString());
      });
  }

  private emitCommand(handler, args) {
    this.commander.emit({
      command: {
        class: this.constructor.name,
        handler,
        args
      }
    });
  }
}
