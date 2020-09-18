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
  UnauthorizedException
} from "@nestjs/common";
import {Identity, IdentityService} from "@spica-server/passport/identity";
import {Subject, throwError} from "rxjs";
import {catchError, take, timeout} from "rxjs/operators";
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
    @Query("state") state: string
  ) {
    let identity: Identity;

    if (!state) {
      identity = await this.identity.identify(identifier, password);
      if (!identity) {
        throw new NotFoundException("Identifier or password was incorrect.");
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

  @Get("strategies")
  findAllStrategies() {
    return this.strategy
      .find()
      .then(strategies =>
        strategies.map(({_id, name, icon, type, title}) => ({_id, name, icon, type, title}))
      );
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
  @HttpCode(HttpStatus.NO_CONTENT)
  complete(@Param("name") name: string, @Body() body, @Query("state") stateId: string) {
    if (!stateId) {
      throw new BadRequestException("state query parameter is required.");
    }
    if (!this.assertObservers.has(stateId)) {
      throw new BadRequestException("Authentication has failed due to invalid state.");
    }
    const observer = this.assertObservers.get(stateId);
    return this.saml
      .assert(name, body)
      .then(identity => observer.next(identity))
      .catch(error => observer.error(error));
  }
}
