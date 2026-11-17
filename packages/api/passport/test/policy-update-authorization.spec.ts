import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {SchemaModule, OBJECT_ID, DATE_TIME} from "@spica-server/core-schema";
import {CoreTestingModule, Request} from "@spica-server/core-testing";
import {ConfigModule} from "@spica-server/config";
import {contractSuite} from "@spica-server/database-testing";
import {idOf, withId} from "@spica-server/data";
import {PassportModule} from "@spica-server/passport";
import {PreferenceTestingModule} from "@spica-server/preference-testing";

const EXPIRES_IN = 60 * 60 * 24;

contractSuite("policy update authorization", engine => {
  let app: INestApplication;
  let req: Request;
  let adminToken: string;
  let limitedToken: string;
  let allowedId: string;
  let otherId: string;

  const policy = (name: string, statement: object[] = []) => ({
    name,
    description: `${name} policy`,
    statement
  });

  const asAdmin = () => ({Authorization: `IDENTITY ${adminToken}`});
  const asLimited = () => ({Authorization: `IDENTITY ${limitedToken}`});

  async function identify(identifier: string, password: string) {
    const {body} = await req.post("/passport/identify", {identifier, password});
    return body.token as string;
  }

  beforeEach(async () => {
    const module = await Test.createTestingModule({
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
            refreshTokenExpiresIn: EXPIRES_IN,
            refreshTokenHashSecret: "refresh",
            secretOrKey: "spica",
            blockingOptions: {failedAttemptLimit: 3, blockDurationMinutes: 10},
            passwordHistoryLimit: 2,
            userRealtime: false,
            providerEncryptionSecret: "3fe2e8060da06c70906096b43db6de11"
          },
          identityOptions: {
            expiresIn: EXPIRES_IN,
            issuer: "spica",
            maxExpiresIn: EXPIRES_IN,
            secretOrKey: "spica",
            defaultIdentityIdentifier: "spica",
            defaultIdentityPassword: "spica",
            audience: "spica",
            defaultIdentityPolicies: ["PassportFullAccess"],
            blockingOptions: {failedAttemptLimit: 3, blockDurationMinutes: 10},
            refreshTokenExpiresIn: EXPIRES_IN,
            refreshTokenHashSecret: "refresh",
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
    await new Promise(resolve => setTimeout(resolve, 3000));

    adminToken = await identify("spica", "spica");

    const allowed = await req.post("/passport/policy", policy("allowed"), asAdmin());
    const other = await req.post("/passport/policy", policy("other"), asAdmin());
    allowedId = idOf(allowed.body).toString();
    otherId = idOf(other.body).toString();

    const limitedPolicy = await req.post(
      "/passport/policy",
      policy("limited", [
        {
          action: "passport:policy:update",
          module: "passport:policy",
          resource: {include: [allowedId], exclude: []}
        }
      ]),
      asAdmin()
    );
    const created = await req.post(
      "/passport/identity",
      {identifier: "limited", password: "limited"},
      asAdmin()
    );
    expect(created.statusCode).toBe(201);
    const attached = await req.put(
      `/passport/identity/${idOf(created.body).toString()}/policy/${idOf(limitedPolicy.body).toString()}`,
      undefined,
      asAdmin()
    );
    expect(attached.statusCode).toBe(204);
    limitedToken = await identify("limited", "limited");
    expect(limitedToken).toBeTruthy();
  }, 60000);

  afterEach(() => app.close());

  const read = async (id: string) => (await req.get(`/passport/policy/${id}`, {}, asAdmin())).body;

  it("should let an identity update the policy its statement allows", async () => {
    const response = await req.put(
      `/passport/policy/${allowedId}`,
      policy("allowed renamed"),
      asLimited()
    );

    expect(response.statusCode).toBe(200);
    expect((await read(allowedId)).name).toBe("allowed renamed");
  });

  it("should refuse an update of a policy the statement does not allow", async () => {
    const response = await req.put(`/passport/policy/${otherId}`, policy("hijacked"), asLimited());

    expect(response.statusCode).toBe(403);
    expect((await read(otherId)).name).toBe("other");
  });

  it("should not let a body id redirect an allowed update to another policy", async () => {
    await req.put(
      `/passport/policy/${allowedId}`,
      withId(policy("hijacked"), otherId),
      asLimited()
    );

    expect((await read(otherId)).name).toBe("other");
  });
});
