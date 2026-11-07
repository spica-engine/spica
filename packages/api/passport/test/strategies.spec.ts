import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {ConfigModule} from "@spica-server/config";
import {DATE_TIME, OBJECT_ID, SchemaModule} from "@spica-server/core-schema";
import {CoreTestingModule, Request} from "@spica-server/core-testing";
import {contractSuite} from "@spica-server/database-testing";
import {STRATEGY_REPOSITORY, StrategyRepository} from "@spica-server/interface-passport";
import {PassportModule} from "@spica-server/passport";
import {PreferenceTestingModule} from "@spica-server/preference-testing";

const EXPIRES_IN = 60_000;

contractSuite("passport strategies", engine => {
  let module: TestingModule;
  let app: INestApplication;
  let req: Request;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        SchemaModule.forRoot({formats: [OBJECT_ID, DATE_TIME]}),
        engine.module(),
        ConfigModule.forRoot(),
        PassportModule.forRoot({
          publicUrl: "http://insteadof",
          samlCertificateTTL: EXPIRES_IN,
          defaultStrategy: "IDENTITY",
          apikeyRealtime: false,
          policyRealtime: false,
          refreshTokenRealtime: false,
          userOptions: {
            expiresIn: EXPIRES_IN,
            maxExpiresIn: EXPIRES_IN,
            issuer: "spica",
            audience: "spica",
            refreshTokenExpiresIn: 60 * 60 * 24,
            refreshTokenHashSecret: "strategies_refresh_token_hash_secret",
            secretOrKey: "spica",
            blockingOptions: {failedAttemptLimit: 3, blockDurationMinutes: 10},
            passwordHistoryLimit: 2,
            userRealtime: false,
            providerEncryptionSecret: "3fe2e8060da06c70906096b43db6de11"
          },
          identityOptions: {
            expiresIn: EXPIRES_IN,
            maxExpiresIn: EXPIRES_IN,
            issuer: "spica",
            audience: "spica",
            secretOrKey: "spica",
            defaultIdentityIdentifier: "spica",
            defaultIdentityPassword: "spica",
            defaultIdentityPolicies: ["PassportFullAccess"],
            blockingOptions: {failedAttemptLimit: 3, blockDurationMinutes: 10},
            refreshTokenExpiresIn: 60 * 60 * 24,
            refreshTokenHashSecret: "strategies_refresh_token_hash_secret",
            passwordHistoryLimit: 2,
            identityRealtime: false
          }
        }),
        PreferenceTestingModule,
        CoreTestingModule
      ]
    }).compile();

    req = module.get(Request);
    app = module.createNestApplication();
    await app.listen(req.socket);

    const strategies = module.get<StrategyRepository>(STRATEGY_REPOSITORY);
    await strategies.insert({
      type: "saml",
      name: "saml",
      title: "saml",
      icon: "login",
      options: {ip: {login_url: "/idp/login", logout_url: "/idp/logout", certificate: "cert"}}
    } as any);
    await strategies.insert({
      type: "oauth",
      name: "oauth",
      title: "oauth",
      icon: "login",
      options: {idp: "custom"}
    } as any);
  });

  afterEach(() => app.close());

  it("lists the saml strategies for identities without their options", async () => {
    const {statusCode, body} = await req.get("/passport/identity/strategies");

    expect(statusCode).toBe(200);
    expect(body).toEqual([
      {_id: body[0]._id, type: "saml", name: "saml", title: "saml", icon: "login"}
    ]);
  });

  it("lists the oauth strategies for users without their options", async () => {
    const {statusCode, body} = await req.get("/passport/user/strategies");

    expect(statusCode).toBe(200);
    expect(body).toEqual([
      {_id: body[0]._id, type: "oauth", name: "oauth", title: "oauth", icon: "login"}
    ]);
  });
});
