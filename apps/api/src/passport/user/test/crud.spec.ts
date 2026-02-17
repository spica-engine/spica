import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {PassportModule} from "@spica-server/passport";
import {INestApplication} from "@nestjs/common";
import {SchemaModule} from "@spica-server/core/schema";
import {DATE_TIME, OBJECT_ID} from "@spica-server/core/schema/formats";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {UserService} from "../src/user.service";
import {ObjectId} from "@spica-server/database";

describe("User Email Hashing and Encryption", () => {
  let module: TestingModule;
  let app: INestApplication;
  let req: Request;
  let userService: UserService;
  let adminToken: string;
  let testUserId: string;
  let createdAt: Date;
  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        SchemaModule.forRoot({
          formats: [OBJECT_ID, DATE_TIME]
        }),
        DatabaseTestingModule.replicaSet(),
        PreferenceTestingModule,
        CoreTestingModule,
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

    await app.listen(req.socket);

    await new Promise(resolve => setTimeout(resolve, 3000));

    adminToken = await req
      .post("/passport/identify", {
        identifier: "spica",
        password: "spica"
      })
      .then(res => res.body.token);

    const userId = new ObjectId();
    testUserId = userId.toHexString();
    createdAt = new Date();
    const encryptedEmail = userService.encryptField("test@example.com");
    const emailHash = userService.hashProviderValue("test@example.com");

    await userService.insertOne({
      _id: userId,
      username: "testuser",
      password: "password123",
      email: {
        ...encryptedEmail,
        createdAt: createdAt,
        hash: emailHash
      },
      policies: [],
      lastLogin: null,
      failedAttempts: [],
      lastPasswords: []
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it("should find user by ID and return decrypted email", async () => {
    const getRes = await req.get(`/passport/user/${testUserId}`, undefined, {
      Authorization: `IDENTITY ${adminToken}`
    });

    expect(getRes.statusCode).toBe(200);
    expect(getRes.body).toEqual({
      _id: testUserId,
      username: "testuser",
      email: {
        value: "test@example.com",
        createdAt: createdAt.toISOString()
      },
      policies: [],
      lastLogin: null,
      failedAttempts: []
    });
  });

  it("should find user by email without value property", async () => {
    const listRes = await req.get(
      "/passport/user",
      {filter: JSON.stringify({email: "test@example.com"})},
      {
        Authorization: `IDENTITY ${adminToken}`
      }
    );
    expect(listRes.statusCode).toBe(200);
    expect(listRes.body.length).toBe(1);
    expect(listRes.body[0]).toEqual({
      _id: testUserId,
      username: "testuser",
      email: {
        value: "test@example.com",
        createdAt: createdAt.toISOString()
      },
      policies: [],
      lastLogin: null,
      failedAttempts: []
    });
  });

  it("should find user by email with value property", async () => {
    const listRes = await req.get(
      "/passport/user",
      {filter: JSON.stringify({email: {value: "test@example.com"}})},
      {
        Authorization: `IDENTITY ${adminToken}`
      }
    );
    expect(listRes.statusCode).toBe(200);
    expect(listRes.body.length).toBe(1);
    expect(listRes.body[0]).toEqual({
      _id: testUserId,
      username: "testuser",
      email: {
        value: "test@example.com",
        createdAt: createdAt.toISOString()
      },
      policies: [],
      lastLogin: null,
      failedAttempts: []
    });
  });

  it("should return empty result when searching with wrong email", async () => {
    const listRes = await req.get(
      "/passport/user",
      {filter: JSON.stringify({email: "wrong@example.com"})},
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
        filter: JSON.stringify({
          $or: [{email: "test@example.com"}, {username: "nonexistent"}]
        })
      },
      {
        Authorization: `IDENTITY ${adminToken}`
      }
    );

    expect(listRes.statusCode).toBe(200);
    expect(listRes.body.length).toBe(1);
    expect(listRes.body[0]).toEqual({
      _id: testUserId,
      username: "testuser",
      email: {
        value: "test@example.com",
        createdAt: createdAt.toISOString()
      },
      policies: [],
      lastLogin: null,
      failedAttempts: []
    });
  });

  it("should work with nested logical operators using email", async () => {
    const listRes = await req.get(
      "/passport/user",
      {
        filter: JSON.stringify({
          $or: [
            {$and: [{email: "test@example.com"}, {username: "testuser"}]},
            {username: "nonexistent"}
          ]
        })
      },
      {
        Authorization: `IDENTITY ${adminToken}`
      }
    );

    expect(listRes.statusCode).toBe(200);
    expect(listRes.body.length).toBe(1);
    expect(listRes.body[0]).toEqual({
      _id: testUserId,
      username: "testuser",
      email: {
        value: "test@example.com",
        createdAt: createdAt.toISOString()
      },
      policies: [],
      lastLogin: null,
      failedAttempts: []
    });
  });
});
