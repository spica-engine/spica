import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {ConfigModule} from "@spica-server/config";
import {DATE_TIME, OBJECT_ID, SchemaModule} from "@spica-server/core-schema";
import {CoreTestingModule, Request} from "@spica-server/core-testing";
import {contractSuite} from "@spica-server/database-testing";
import {ID_TYPES, IdTypes} from "@spica-server/interface-data";
import {IDENTITY_REPOSITORY, IdentityRepository} from "@spica-server/interface-passport-identity";
import {PassportModule} from "@spica-server/passport";
import {PreferenceTestingModule} from "@spica-server/preference-testing";
import cookieParser from "cookie-parser";

const EXPIRES_IN = 60_000;

contractSuite("passport login", engine => {
  let module: TestingModule;
  let app: INestApplication;
  let req: Request;
  let token: string;
  let cookie: string;

  const authorization = (value = token, scheme = "IDENTITY") => ({
    Authorization: `${scheme} ${value}`
  });

  async function identify(identifier = "spica", password = "spica") {
    const response = await req.post("/passport/identify", {identifier, password});
    if (response.statusCode < 300) {
      token = response.body.token;
      cookie = (response.headers["set-cookie"] as unknown as string[])?.[0]?.split(";")[0];
    }
    return response;
  }

  async function waitForDefaultIdentity() {
    const identities = module.get<IdentityRepository>(IDENTITY_REPOSITORY);
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await identities.findByIdentifier("spica")) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error("The default identity was not inserted.");
  }

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
            refreshTokenHashSecret: "login_refresh_token_hash_secret",
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
            refreshTokenHashSecret: "login_refresh_token_hash_secret",
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
    app.use(cookieParser());
    await app.listen(req.socket);
    await waitForDefaultIdentity();
  });

  afterEach(() => app.close());

  it("identifies the default identity and hands out a token and a refresh cookie", async () => {
    const response = await identify();

    expect(response.statusCode).toBe(200);
    expect(response.body.token).toEqual(expect.any(String));
    expect(cookie).toMatch(/^refreshToken=/);
  });

  it("rejects wrong credentials", async () => {
    const wrongPassword = await identify("spica", "wrong");
    const unknownIdentity = await identify("nobody", "spica");

    expect(wrongPassword.statusCode).toBeGreaterThanOrEqual(400);
    expect(wrongPassword.body.token).toBeUndefined();
    expect(unknownIdentity.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("blocks the identity after too many failed attempts", async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      await identify("spica", "wrong");
    }

    const blocked = await identify("spica", "spica");

    expect(blocked.statusCode).toBe(429);
  });

  it("verifies the token and shows the identity without its secrets", async () => {
    await identify();

    const {body: verified} = await req.get("/passport/identity/verify", {}, {Authorization: token});
    const idType = module.get<IdTypes>(ID_TYPES).forCollection("identity");
    expect(idType.isValid(String(verified._id))).toBe(true);

    const {statusCode, body: identity} = await req.get(
      `/passport/identity/${verified._id}`,
      {},
      authorization()
    );
    expect(statusCode).toBe(200);
    expect(identity).toMatchObject({identifier: "spica", policies: ["PassportFullAccess"]});
    expect(identity).not.toHaveProperty("password");
    expect(identity).not.toHaveProperty("lastPasswords");
  });

  it("refuses requests without a valid token", async () => {
    await identify();

    const {statusCode} = await req.get("/passport/identity/verify", {}, {Authorization: "invalid"});

    expect(statusCode).toBeGreaterThanOrEqual(400);
  });

  it("refreshes the token with the refresh cookie", async () => {
    await identify();
    const previous = token;

    const response = await req.post(
      "/passport/identity/session/refresh",
      {},
      {...authorization(), Cookie: cookie}
    );

    expect(response.statusCode).toBe(200);
    expect(response.body.token).toEqual(expect.any(String));
    const {statusCode} = await req.get(
      "/passport/identity/verify",
      {},
      {Authorization: response.body.token}
    );
    expect(statusCode).toBe(200);
    expect(previous).toEqual(expect.any(String));
  });

  it("refuses to refresh without the refresh cookie", async () => {
    await identify();

    const response = await req.post("/passport/identity/session/refresh", {}, authorization());

    expect(response.statusCode).toBe(401);
  });

  it("authenticates with an api key that has a policy", async () => {
    await identify();
    const {body: apiKey} = await req.post(
      "/passport/apikey",
      {name: "key", active: true},
      authorization()
    );
    expect(apiKey.key).toEqual(expect.any(String));

    const before = await req.get(
      `/passport/apikey/${apiKey._id}`,
      {},
      authorization(apiKey.key, "APIKEY")
    );
    await req.put(`/passport/apikey/${apiKey._id}/policy/PassportFullAccess`, {}, authorization());
    const after = await req.get(
      `/passport/apikey/${apiKey._id}`,
      {},
      authorization(apiKey.key, "APIKEY")
    );

    expect(before.statusCode).toBeGreaterThanOrEqual(400);
    expect(after.statusCode).toBe(200);
    expect(after.body).toMatchObject({name: "key", policies: ["PassportFullAccess"]});
  });

  it("stops authenticating an inactive api key", async () => {
    await identify();
    const {body: apiKey} = await req.post(
      "/passport/apikey",
      {name: "key", active: true},
      authorization()
    );
    await req.put(`/passport/apikey/${apiKey._id}/policy/PassportFullAccess`, {}, authorization());
    await req.put(
      `/passport/apikey/${apiKey._id}`,
      {name: "key", active: false, key: apiKey.key},
      authorization()
    );

    const {statusCode} = await req.get(
      `/passport/apikey/${apiKey._id}`,
      {},
      authorization(apiKey.key, "APIKEY")
    );

    expect(statusCode).toBeGreaterThanOrEqual(400);
  });

  it("stores and applies a custom policy", async () => {
    await identify();
    const {body: policy} = await req.post(
      "/passport/policy",
      {
        name: "readers",
        description: "Can read identities",
        statement: [{action: "passport:identity:show", module: "passport:identity"}]
      },
      authorization()
    );
    expect(policy.name).toBe("readers");

    const {body: policies} = await req.get(`/passport/policy/${policy._id}`, {}, authorization());

    expect(policies).toMatchObject({name: "readers"});
  });
});
