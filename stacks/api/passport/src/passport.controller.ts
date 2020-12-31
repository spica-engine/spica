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
  NotFoundException,
  Param,
  Post,
  Query,
  UnauthorizedException,
  UseInterceptors,
  Req
} from "@nestjs/common";
import {Identity, IdentityService, LoginCredentials} from "@spica-server/passport/identity";
import {Subject, throwError} from "rxjs";
import {catchError, take, timeout} from "rxjs/operators";
import {UrlEncodedBodyParser} from "./body";
import {SamlService} from "./saml.service";
import {StrategyService} from "./strategy/strategy.service";

/**
 * @name passport
 */
@Controller("passport")
export class PassportController {
  assertObservers = new Map<string, Subject<any>>();

  constructor(
    private identity: IdentityService,
    private saml: SamlService,
    private strategy: StrategyService
  ) {}

  @Get("identify")
  async identify(
    @Query("identifier") identifier: string,
    @Query("password") password: string,
    @Query("state") state: string,
    @Req() req: any
  ) {
    req.res.append(
      "Warning",
      `299 "Identify with 'GET' method has been deprecated. Use 'POST' instead."`
    );

    let identity: Identity;

    if (!state) {
      identity = await this.identity.identify(identifier, password);
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
                : new UnauthorizedException(String(error))
            );
          })
        )
        .toPromise();
      this.assertObservers.delete(state);

      if (!user || (user && !user.upn)) {
        throw new InternalServerErrorException("Authentication has failed.");
      }

      identity = await this.identity.findOne({identifier: user.upn});

      if (!identity) {
        identity = await this.identity.insertOne({
          identifier: user.upn,
          password: undefined,
          policies: []
        });
      }
    }

    return this.identity.sign(identity);
  }

  @Post("identify")
  async identifyWithPost(@Body() credentials: LoginCredentials) {
    let identity: Identity;

    if (!credentials.state) {
      identity = await this.identity.identify(credentials.identifier, credentials.password);
      if (!identity) {
        throw new UnauthorizedException("Identifier or password was incorrect.");
      }
    } else {
      if (!this.assertObservers.has(credentials.state)) {
        throw new BadRequestException("Authentication has failed due to invalid state.");
      }

      const observer = this.assertObservers.get(credentials.state);

      const {user} = await observer
        .pipe(
          timeout(60000),
          take(1),
          catchError(error => {
            this.assertObservers.delete(credentials.state);
            return throwError(
              error && error.name == "TimeoutError"
                ? new GatewayTimeoutException("Operation did not complete within one minute.")
                : new UnauthorizedException(String(error))
            );
          })
        )
        .toPromise();
      this.assertObservers.delete(credentials.state);

      if (!user || (user && !user.upn)) {
        throw new InternalServerErrorException("Authentication has failed.");
      }

      identity = await this.identity.findOne({identifier: user.upn});

      if (!identity) {
        identity = await this.identity.insertOne({
          identifier: user.upn,
          password: undefined,
          policies: []
        });
      }
    }

    return this.identity.sign(identity);
  }

  @Get("strategies")
  async strategies() {
    const strategies = await this.strategy.find();
    return strategies.map(({_id, name, icon, type, title}) => ({_id, name, icon, type, title}));
  }

  @Get("strategy/:name/url")
  async getUrl(@Param("name") name: string) {
    const login = await this.saml.getLoginUrl(name);

    if (!name) {
      throw new BadRequestException("strategy parameter is required.");
    }

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
    return this.saml.createMetadata(name);
  }

  @Post("strategy/:name/complete")
  @UseInterceptors(UrlEncodedBodyParser())
  @HttpCode(HttpStatus.NO_CONTENT)
  async complete(
    @Param("name") name: string,
    @Body() body: unknown,
    @Query("state") stateId: string
  ) {
    if (!stateId) {
      throw new BadRequestException("state query parameter is required.");
    }
    if (!this.assertObservers.has(stateId)) {
      throw new BadRequestException("Authentication has failed due to invalid state.");
    }
    const observer = this.assertObservers.get(stateId);
    try {
      const identity = await this.saml.assert(name, body);
      return observer.next(identity);
    } catch (error) {
      return observer.error(error);
    }
  }
}
