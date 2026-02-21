import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseTestingModule, DatabaseService} from "@spica-server/database/testing";
import {PassportModule} from "@spica-server/passport";
import {SchemaModule} from "@spica-server/core/schema";
import {OBJECT_ID, DATE_TIME} from "@spica-server/core/schema/formats";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {ConfigModule} from "@spica-server/config/src/config.module";

describe("Password Policy - User", () => {
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
            defaultIdentityPolicies: ["PassportFullAccess", "IdentityFullAccess", "UserFullAccess"],
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
    it("should accept any password with minLength >= 3 on create", async () => {
      const res = await req.post(
        "/passport/user",
        {username: "nopolicy_user", password: "abc"},
        {Authorization: `IDENTITY ${adminToken}`}
      );
      expect(res.statusCode).toEqual(201);
    });

    afterAll(async () => {
      await database.collection("user").deleteMany({});
    });
  });

  describe("with user password policy config", () => {
    beforeAll(async () => {
      await database.collection("config").insertOne({
        module: "passport",
        options: {
          user: {
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
      await new Promise(resolve => setTimeout(resolve, 2000));
    });

    afterAll(async () => {
      await database.collection("config").deleteMany({module: "passport"});
      await database.collection("user").deleteMany({});
      await new Promise(resolve => setTimeout(resolve, 1000));
    });

    it("should reject password shorter than minLength on user create", async () => {
      const res = await req.post(
        "/passport/user",
        {username: "user_short", password: "aB1!xyz"},
        {Authorization: `IDENTITY ${adminToken}`}
      );
      expect(res.statusCode).toEqual(400);
    });

    it("should reject password missing lowercase on user create", async () => {
      const res = await req.post(
        "/passport/user",
        {username: "user_nolower", password: "ABCDEFG1!"},
        {Authorization: `IDENTITY ${adminToken}`}
      );
      expect(res.statusCode).toEqual(400);
    });

    it("should reject password missing uppercase on user create", async () => {
      const res = await req.post(
        "/passport/user",
        {username: "user_noupper", password: "abcdefg1!"},
        {Authorization: `IDENTITY ${adminToken}`}
      );
      expect(res.statusCode).toEqual(400);
    });

    it("should reject password missing number on user create", async () => {
      const res = await req.post(
        "/passport/user",
        {username: "user_nonum", password: "abcDefgh!"},
        {Authorization: `IDENTITY ${adminToken}`}
      );
      expect(res.statusCode).toEqual(400);
    });

    it("should reject password missing special character on user create", async () => {
      const res = await req.post(
        "/passport/user",
        {username: "user_nospec", password: "abcDefg1"},
        {Authorization: `IDENTITY ${adminToken}`}
      );
      expect(res.statusCode).toEqual(400);
    });

    it("should accept compliant password on user create", async () => {
      const res = await req.post(
        "/passport/user",
        {username: "user_valid", password: "Valid1pw!"},
        {Authorization: `IDENTITY ${adminToken}`}
      );
      expect(res.statusCode).toEqual(201);
    });

    it("should reject non-compliant password on user update", async () => {
      const createRes = await req.post(
        "/passport/user",
        {username: "user_upd", password: "Valid1pw!"},
        {Authorization: `IDENTITY ${adminToken}`}
      );
      expect(createRes.statusCode).toEqual(201);
      const id = createRes.body._id;

      const updateRes = await req.put(
        `/passport/user/${id}`,
        {password: "weak"},
        {Authorization: `IDENTITY ${adminToken}`}
      );
      expect(updateRes.statusCode).toEqual(400);
    });

    it("should accept compliant password on user update", async () => {
      const createRes = await req.post(
        "/passport/user",
        {username: "user_upd2", password: "Valid1pw!"},
        {Authorization: `IDENTITY ${adminToken}`}
      );
      expect(createRes.statusCode).toEqual(201);
      const id = createRes.body._id;

      const updateRes = await req.put(
        `/passport/user/${id}`,
        {password: "NewPw2ok!"},
        {Authorization: `IDENTITY ${adminToken}`}
      );
      expect(updateRes.statusCode).toEqual(200);
    });

    it("should reject non-compliant password on user self-update", async () => {
      const createRes = await req.post(
        "/passport/user",
        {username: "user_self", password: "Valid1pw!"},
        {Authorization: `IDENTITY ${adminToken}`}
      );
      expect(createRes.statusCode).toEqual(201);
      const id = createRes.body._id;

      const loginRes = await req.post("/passport/login", {
        username: "user_self",
        password: "Valid1pw!"
      });
      const userToken = loginRes.body.token;

      const updateRes = await req.put(
        `/passport/user/${id}/self`,
        {password: "weak"},
        {Authorization: `USER ${userToken}`}
      );
      expect(updateRes.statusCode).toEqual(400);
    });

    it("should accept compliant password on user self-update", async () => {
      const createRes = await req.post(
        "/passport/user",
        {username: "user_self2", password: "Valid1pw!"},
        {Authorization: `IDENTITY ${adminToken}`}
      );
      expect(createRes.statusCode).toEqual(201);
      const id = createRes.body._id;

      const loginRes = await req.post("/passport/login", {
        username: "user_self2",
        password: "Valid1pw!"
      });
      const userToken = loginRes.body.token;

      const updateRes = await req.put(
        `/passport/user/${id}/self`,
        {password: "NewPw2ok!"},
        {Authorization: `USER ${userToken}`}
      );
      expect(updateRes.statusCode).toEqual(200);
    });
  });

  describe("user policy independent from identity policy", () => {
    beforeAll(async () => {
      await database.collection("config").deleteMany({module: "passport"});
      await database.collection("config").insertOne({
        module: "passport",
        options: {
          identity: {
            password: {
              minLength: 12,
              minUppercase: 3
            }
          },
          user: {
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
      await database.collection("user").deleteMany({});
      await new Promise(resolve => setTimeout(resolve, 1000));
    });

    it("should enforce user policy (minLength 6), not identity policy", async () => {
      const res = await req.post(
        "/passport/user",
        {username: "user_indep", password: "abcdef"},
        {Authorization: `IDENTITY ${adminToken}`}
      );
      expect(res.statusCode).toEqual(201);
    });

    it("should reject user password shorter than user minLength", async () => {
      const res = await req.post(
        "/passport/user",
        {username: "user_indep2", password: "abcde"},
        {Authorization: `IDENTITY ${adminToken}`}
      );
      expect(res.statusCode).toEqual(400);
    });
  });
});
