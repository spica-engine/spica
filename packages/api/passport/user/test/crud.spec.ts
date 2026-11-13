import {USER_REPOSITORY} from "@spica-server/interface-passport-user";
import {Test, TestingModule} from "@nestjs/testing";
import {contractSuite} from "@spica-server/database-testing";
import {ID_TYPES, IdTypes} from "@spica-server/interface-data";
import {CoreTestingModule, Request} from "@spica-server/core-testing";
import {PassportModule} from "@spica-server/passport";
import {INestApplication} from "@nestjs/common";
import {SchemaModule} from "@spica-server/core-schema";
import {DATE_TIME, OBJECT_ID} from "@spica-server/core-schema";
import {PreferenceTestingModule} from "@spica-server/preference-testing";
import {UserService} from "../src/user.service";
import {ConfigModule} from "@spica-server/config";
import {withId} from "@spica-server/data";

contractSuite("User Email Hashing and Encryption", engine => {
  let module: TestingModule;
  let app: INestApplication;
  let req: Request;
  let userService: UserService;
  let users: any;
  let adminToken: string;
  let testUserId: string;
  let createdAt: Date;

  const filterOf = (mongodb: object, postgresql: string) =>
    engine.name == "mongodb" ? JSON.stringify(mongodb) : postgresql;
  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        SchemaModule.forRoot({
          formats: [OBJECT_ID, DATE_TIME]
        }),
        engine.module(),
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
            defaultIdentityPolicies: ["UserFullAccess", "IdentityFullAccess", "PolicyFullAccess"],
            blockingOptions: {
              blockDurationMinutes: 0,
              failedAttemptLimit: 0
            },
            refreshTokenExpiresIn: 60000,
            refreshTokenHashSecret: "refresh_token_hash_secret",
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
            refreshTokenHashSecret: "refresh_token_hash_secret",
            passwordHistoryLimit: 0,
            userRealtime: false,
            providerEncryptionSecret: "3fe2e8060da06c70906096b43db6de11",
            providerHashSecret: "8fe2e8060da06c70906096b43db6de99"
          }
        })
      ]
    }).compile();

    app = module.createNestApplication();
    req = module.get(Request);
    userService = module.get(UserService);
    users = module.get(USER_REPOSITORY);

    await app.listen(req.socket);

    await new Promise(resolve => setTimeout(resolve, 3000));

    adminToken = await req
      .post("/passport/identify", {
        identifier: "spica",
        password: "spica"
      })
      .then(res => res.body.token);

    const userId = module.get<IdTypes>(ID_TYPES).forCollection("user").generate();
    testUserId = String(userId);
    createdAt = new Date();
    const encryptedEmail = userService.encryptField("test@example.com");

    await users.insert(
      withId(
        {
          username: "testuser",
          password: "password123",
          email: encryptedEmail,
          email_verified_at: createdAt,
          policies: [],
          lastLogin: null,
          failedAttempts: [],
          lastPasswords: []
        },
        userId
      )
    );
  });

  afterEach(async () => {
    await app.close();
  });

  it("should find user by ID and return decrypted email", async () => {
    const getRes = await req.get(`/passport/user/${testUserId}`, undefined, {
      Authorization: `IDENTITY ${adminToken}`
    });

    expect(getRes.statusCode).toBe(200);
    expect(getRes.body).toEqual(
      withId(
        {
          username: "testuser",
          email: "test@example.com",
          email_verified_at: createdAt.toISOString(),
          policies: [],
          lastLogin: null,
          failedAttempts: []
        },
        testUserId
      )
    );
  });

  it("should find user by email", async () => {
    const listRes = await req.get(
      "/passport/user",
      {filter: filterOf({email: "test@example.com"}, "document.email == 'test@example.com'")},
      {
        Authorization: `IDENTITY ${adminToken}`
      }
    );
    expect(listRes.statusCode).toBe(200);
    expect(listRes.body.length).toBe(1);
    expect(listRes.body[0]).toEqual(
      withId(
        {
          username: "testuser",
          email: "test@example.com",
          email_verified_at: createdAt.toISOString(),
          policies: [],
          lastLogin: null,
          failedAttempts: []
        },
        testUserId
      )
    );
  });

  it("should return empty result when searching with wrong email", async () => {
    const listRes = await req.get(
      "/passport/user",
      {filter: filterOf({email: "wrong@example.com"}, "document.email == 'wrong@example.com'")},
      {
        Authorization: `IDENTITY ${adminToken}`
      }
    );

    expect(listRes.statusCode).toBe(200);
    expect(listRes.body.length).toBe(0);
  });

  it("should find user with logical query operators using email", async () => {
    const listRes = await req.get(
      "/passport/user",
      {
        filter: filterOf(
          {$or: [{email: "test@example.com"}, {username: "nonexistent"}]},
          "document.email == 'test@example.com' || document.username == 'nonexistent'"
        )
      },
      {
        Authorization: `IDENTITY ${adminToken}`
      }
    );

    expect(listRes.statusCode).toBe(200);
    expect(listRes.body.length).toBe(1);
    expect(listRes.body[0]).toEqual(
      withId(
        {
          username: "testuser",
          email: "test@example.com",
          email_verified_at: createdAt.toISOString(),
          policies: [],
          lastLogin: null,
          failedAttempts: []
        },
        testUserId
      )
    );
  });

  it("should work with nested logical operators using email", async () => {
    const listRes = await req.get(
      "/passport/user",
      {
        filter: filterOf(
          {
            $or: [
              {$and: [{email: "test@example.com"}, {username: "testuser"}]},
              {username: "nonexistent"}
            ]
          },
          "(document.email == 'test@example.com' && document.username == 'testuser') || document.username == 'nonexistent'"
        )
      },
      {
        Authorization: `IDENTITY ${adminToken}`
      }
    );

    expect(listRes.statusCode).toBe(200);
    expect(listRes.body.length).toBe(1);
    expect(listRes.body[0]).toEqual(
      withId(
        {
          username: "testuser",
          email: "test@example.com",
          email_verified_at: createdAt.toISOString(),
          policies: [],
          lastLogin: null,
          failedAttempts: []
        },
        testUserId
      )
    );
  });
});
