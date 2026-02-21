import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseTestingModule, DatabaseService} from "@spica-server/database/testing";
import {PassportModule} from "@spica-server/passport";
import {SchemaModule} from "@spica-server/core/schema";
import {OBJECT_ID, DATE_TIME} from "@spica-server/core/schema/formats";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {ConfigModule} from "@spica-server/config/src/config.module";

describe("Password Policy - Identity", () => {
  let app: INestApplication;
  let req: Request;
  let database: DatabaseService;
  let adminToken: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        SchemaModule.forRoot({
          formats: [OBJECT_ID, DATE_TIME]
        }),
        DatabaseTestingModule.replicaSet(),
        PreferenceTestingModule,
        CoreTestingModule,
        ConfigModule.forRoot(),
        PassportModule.forRoot({
          publicUrl: "http://localhost:3000",
          samlCertificateTTL: 604800,
          defaultStrategy: "IDENTITY",
          apikeyRealtime: false,
          refreshTokenRealtime: false,
          policyRealtime: false,
          identityOptions: {
            expiresIn: 60000,
            maxExpiresIn: 60000,
            issuer: "spica",
            secretOrKey: "spica",
            audience: "spica",
            defaultIdentityIdentifier: "spica",
            defaultIdentityPassword: "spica",
            defaultIdentityPolicies: ["PassportFullAccess"],
            blockingOptions: {
              blockDurationMinutes: 0,
              failedAttemptLimit: 0
            },
            refreshTokenExpiresIn: 60000,
            passwordHistoryLimit: 0,
            identityRealtime: false
          },
          userOptions: {
            expiresIn: 60000,
            maxExpiresIn: 60000,
            issuer: "spica",
            secretOrKey: "spica",
            audience: "spica",
            blockingOptions: {
              blockDurationMinutes: 0,
              failedAttemptLimit: 0
            },
            refreshTokenExpiresIn: 60000,
            passwordHistoryLimit: 0,
            userRealtime: false
          }
        })
      ]
    }).compile();

    app = module.createNestApplication();
    req = module.get(Request);
    database = module.get(DatabaseService);

    await app.listen(req.socket);

    await new Promise(resolve => setTimeout(resolve, 3000));

    adminToken = await req
      .post("/passport/identify", {
        identifier: "spica",
        password: "spica"
      })
      .then(res => res.body.token);
  });

  afterAll(() => app.close());

  describe("without password policy config", () => {
    it("should accept any password with minLength >= 3", async () => {
      const res = await req.post(
        "/passport/identity",
        {identifier: "nopolicy1", password: "abc"},
        {Authorization: `IDENTITY ${adminToken}`}
      );
      expect(res.statusCode).toEqual(201);
    });

    afterAll(async () => {
      await database.collection("identity").deleteMany({identifier: {$ne: "spica"}});
    });
  });

  describe("with password policy config", () => {
    beforeAll(async () => {
      await database.collection("config").insertOne({
        module: "passport",
        options: {
          identity: {
            password: {
              minLength: 8,
              minLowercase: 1,
              minUppercase: 1,
              minNumber: 1,
              minSpecialCharacter: 1
            }
          }
        }
      });

      // Wait for change stream to propagate
      await new Promise(resolve => setTimeout(resolve, 2000));
    });

    afterAll(async () => {
      await database.collection("config").deleteMany({module: "passport"});
      await database.collection("identity").deleteMany({identifier: {$ne: "spica"}});
      await new Promise(resolve => setTimeout(resolve, 1000));
    });

    it("should reject password shorter than minLength", async () => {
      const res = await req.post(
        "/passport/identity",
        {identifier: "test_short", password: "aB1!xyz"},
        {Authorization: `IDENTITY ${adminToken}`}
      );
      expect(res.statusCode).toEqual(400);
    });

    it("should reject password missing lowercase", async () => {
      const res = await req.post(
        "/passport/identity",
        {identifier: "test_nolower", password: "ABCDEFG1!"},
        {Authorization: `IDENTITY ${adminToken}`}
      );
      expect(res.statusCode).toEqual(400);
    });

    it("should reject password missing uppercase", async () => {
      const res = await req.post(
        "/passport/identity",
        {identifier: "test_noupper", password: "abcdefg1!"},
        {Authorization: `IDENTITY ${adminToken}`}
      );
      expect(res.statusCode).toEqual(400);
    });

    it("should reject password missing number", async () => {
      const res = await req.post(
        "/passport/identity",
        {identifier: "test_nonum", password: "abcDefgh!"},
        {Authorization: `IDENTITY ${adminToken}`}
      );
      expect(res.statusCode).toEqual(400);
    });

    it("should reject password missing special character", async () => {
      const res = await req.post(
        "/passport/identity",
        {identifier: "test_nospec", password: "abcDefg1"},
        {Authorization: `IDENTITY ${adminToken}`}
      );
      expect(res.statusCode).toEqual(400);
    });

    it("should accept compliant password on create", async () => {
      const res = await req.post(
        "/passport/identity",
        {identifier: "test_valid", password: "Valid1pw!"},
        {Authorization: `IDENTITY ${adminToken}`}
      );
      expect(res.statusCode).toEqual(201);
    });

    it("should reject non-compliant password on update", async () => {
      const createRes = await req.post(
        "/passport/identity",
        {identifier: "test_update", password: "Valid1pw!"},
        {Authorization: `IDENTITY ${adminToken}`}
      );
      expect(createRes.statusCode).toEqual(201);
      const id = createRes.body._id;

      const updateRes = await req.put(
        `/passport/identity/${id}`,
        {identifier: "test_update", password: "weak"},
        {Authorization: `IDENTITY ${adminToken}`}
      );
      expect(updateRes.statusCode).toEqual(400);
    });

    it("should accept compliant password on update", async () => {
      const createRes = await req.post(
        "/passport/identity",
        {identifier: "test_update2", password: "Valid1pw!"},
        {Authorization: `IDENTITY ${adminToken}`}
      );
      expect(createRes.statusCode).toEqual(201);
      const id = createRes.body._id;

      const updateRes = await req.put(
        `/passport/identity/${id}`,
        {identifier: "test_update2", password: "NewPw2ok!"},
        {Authorization: `IDENTITY ${adminToken}`}
      );
      expect(updateRes.statusCode).toEqual(200);
    });
  });

  describe("with partial password policy (only minLength)", () => {
    beforeAll(async () => {
      await database.collection("config").deleteMany({module: "passport"});
      await database.collection("config").insertOne({
        module: "passport",
        options: {
          identity: {
            password: {
              minLength: 6
            }
          }
        }
      });
      await new Promise(resolve => setTimeout(resolve, 2000));
    });

    afterAll(async () => {
      await database.collection("config").deleteMany({module: "passport"});
      await database.collection("identity").deleteMany({identifier: {$ne: "spica"}});
      await new Promise(resolve => setTimeout(resolve, 1000));
    });

    it("should reject password shorter than minLength", async () => {
      const res = await req.post(
        "/passport/identity",
        {identifier: "part_short", password: "abcde"},
        {Authorization: `IDENTITY ${adminToken}`}
      );
      expect(res.statusCode).toEqual(400);
    });

    it("should accept password meeting minLength without character requirements", async () => {
      const res = await req.post(
        "/passport/identity",
        {identifier: "part_ok", password: "abcdef"},
        {Authorization: `IDENTITY ${adminToken}`}
      );
      expect(res.statusCode).toEqual(201);
    });
  });
});
