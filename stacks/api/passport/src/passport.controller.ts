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
  All
} from "@nestjs/common";
import {Identity, IdentityService, LoginCredentials} from "@spica-server/passport/identity";
import {Subject, throwError} from "rxjs";
import {catchError, take, timeout} from "rxjs/operators";
import {UrlEncodedBodyParser} from "./body";
import {SamlService} from "./strategy/services/saml.service";
import {StrategyService} from "./strategy/services/strategy.service";
import {NUMBER} from "@spica-server/core";
import {Schema} from "@spica-server/core/schema";
import {OAuthService} from "./strategy/services/oauth.service";
import {getStrategyService} from "./utilities";
import {ObjectId, OBJECT_ID} from "@spica-server/database";

const assertObservers = new Map<string, Subject<any>>();
/**
 * @name passport
 */
@Controller("passport")
export class PassportController {
  constructor(
    private identity: IdentityService,
    private saml: SamlService,
    private oauth: OAuthService,
    private strategy: StrategyService
  ) {}

  async _identify(identifier: string, password: string, state: string, expiresIn: number) {
    let identity: Identity;

    if (!state) {
      identity = await this.identity.identify(identifier, password);
      if (!identity) {
        throw new UnauthorizedException("Identifier or password was incorrect.");
      }
    } else {
      if (!assertObservers.has(state)) {
        throw new BadRequestException("Authentication has failed due to invalid state.");
      }

      const observer = assertObservers.get(state);

      const {user} = await observer
        .pipe(
          timeout(60000),
          take(1),
          catchError(error => {
            assertObservers.delete(state);
            return throwError(
              error && error.name == "TimeoutError"
                ? new GatewayTimeoutException("Operation did not complete within one minute.")
                : new UnauthorizedException(JSON.stringify(error))
            );
          })
        )
        .toPromise();
      assertObservers.delete(state);

      const idenfitifer = user ? user.upn || user.name_id || user.email || user.id : undefined;

      if (!idenfitifer) {
        throw new BadRequestException(
          "Response should include at least one of these values: upn, name_id, email, id."
        );
      }

      identity = await this.identity.findOne({identifier: idenfitifer});

      // HQ sends attributes field which contains unacceptable fields for mongodb
      delete user.attributes;

      if (!identity) {
        identity = await this.identity.insertOne({
          identifier: idenfitifer,
          password: undefined,
          policies: [],
          attributes: user
        });
      }
    }

    return this.identity.sign(identity, expiresIn);
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

    return this._identify(identifier, password, state, expiresIn);
  }

  @Post("identify")
  identifyWithPost(
    @Body(Schema.validate("http://spica.internal/login")) credentials: LoginCredentials
  ) {
    return this._identify(
      credentials.identifier,
      credentials.password,
      credentials.state,
      credentials.expires
    );
  }

  @Get("strategies")
  async strategies() {
    return this.strategy.aggregate([{$project: {options: 0}}]).toArray();
  }

  @Get("strategy/:id/url")
  async getUrl(@Param("id", OBJECT_ID) id: ObjectId) {
    const strategy = await this.strategy.findOne({_id: id});

    if (!strategy) {
      throw new BadRequestException("Strategy does not exist.");
    }

    const service = getStrategyService([this.saml, this.oauth], strategy.type);

    const login = await service.getLoginUrl(strategy);

    if (!login) {
      throw new InternalServerErrorException("Cannot generate login url.");
    }

    const observer = new Subject();

    assertObservers.set(login.state, observer);

    return login;
  }

  @Get("strategy/:name/metadata")
  @Header("Content-type", "application/xml")
  metadata(@Param("name") name: string) {
    return this.saml.createMetadata(name);
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

    if (!assertObservers.has(stateId)) {
      throw new BadRequestException("Authentication has failed due to invalid state.");
    }

    const strategy = await this.strategy.findOne({_id: id});

    if (!strategy) {
      throw new BadRequestException("Strategy does not exist.");
    }

    const service = getStrategyService([this.saml, this.oauth], strategy.type);

    const observer = assertObservers.get(stateId);

    return service
      .assert(strategy, body, code)
      .then(identity => observer.next(identity))
      .catch(e => {
        console.log(e);
        observer.error(e.toString());
      });
  }
}
