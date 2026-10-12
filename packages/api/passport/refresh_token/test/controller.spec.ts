import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Request} from "@spica-server/core-testing";
import {DatabaseTestingModule} from "@spica-server/database-testing";
import {PassportTestingModule} from "@spica-server/passport-testing";
import {SchemaModule, hash} from "@spica-server/core-schema";
import {OBJECT_ID} from "@spica-server/core-schema";
import {RefreshTokenModule} from "@spica-server/passport-refresh_token";
import {RefreshTokenService} from "@spica-server/passport-refresh_token-services";
import {RefreshToken} from "@spica-server/interface-passport-refresh_token";

import {ObjectId} from "@spica-devkit/database";

const REFRESH_TOKEN_EXPIRES_IN = 1 * 24 * 60 * 60;

describe("ApiKey", () => {
  let req: Request;
  let app: INestApplication;
  let service: RefreshTokenService;
  let tokens: RefreshToken[] = [];

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        DatabaseTestingModule.standalone(),
        CoreTestingModule,
        // PreferenceTestingModule,
        PassportTestingModule.initialize(),
        RefreshTokenModule.forRoot({
          expiresIn: REFRESH_TOKEN_EXPIRES_IN,
          realtime: false
        }),
        SchemaModule.forRoot({formats: [OBJECT_ID]})
      ]
    }).compile();

    req = module.get(Request);
    service = module.get(RefreshTokenService);

    app = module.createNestApplication();

    await app.listen(req.socket);
  });

  beforeEach(async () => {
    const token1_id = new ObjectId("68399c4c347570ceac5d4806");
    const token2_id = new ObjectId("68399c56afa9a30634a8fefd");
    const created_at1 = new Date("2000-01-01T00:00:00.000Z");
    const created_at2 = new Date("2000-01-01T12:00:00.000Z");
    const expired_at = new Date("2000-01-02T00:00:00.000Z");

    tokens = [
      {
        _id: token1_id,
        identity: "user1",
        token: "token1",
        created_at: created_at1,
        expired_at: expired_at,
        last_used_at: created_at1
      },
      {
        _id: token2_id,
        identity: "user2",
        token: "token2",
        created_at: created_at2,
        expired_at: expired_at,
        last_used_at: created_at2
      }
    ];

    await service.insertMany(tokens);
  });

  afterEach(() => app.close());

  describe("find", () => {
    it("should return tokens without sensitive fields", async () => {
      const res = await req.get("/passport/refresh-token");
      expect(res.body).toEqual([
        {
          _id: "68399c4c347570ceac5d4806",
          identity: "user1",
          created_at: "2000-01-01T00:00:00.000Z",
          expired_at: "2000-01-02T00:00:00.000Z",
          last_used_at: "2000-01-01T00:00:00.000Z"
        },
        {
          _id: "68399c56afa9a30634a8fefd",
          identity: "user2",
          created_at: "2000-01-01T12:00:00.000Z",
          expired_at: "2000-01-02T00:00:00.000Z",
          last_used_at: "2000-01-01T12:00:00.000Z"
        }
      ]);
    });

    it("should limit tokens", async () => {
      const res = await req.get("/passport/refresh-token", {limit: 1});
      expect(res.body).toEqual([
        {
          _id: "68399c4c347570ceac5d4806",
          identity: "user1",
          created_at: "2000-01-01T00:00:00.000Z",
          expired_at: "2000-01-02T00:00:00.000Z",
          last_used_at: "2000-01-01T00:00:00.000Z"
        }
      ]);
    });

    it("should skip tokens", async () => {
      const res = await req.get("/passport/refresh-token", {skip: 1});
      expect(res.body).toEqual([
        {
          _id: "68399c56afa9a30634a8fefd",
          identity: "user2",
          created_at: "2000-01-01T12:00:00.000Z",
          expired_at: "2000-01-02T00:00:00.000Z",
          last_used_at: "2000-01-01T12:00:00.000Z"
        }
      ]);
    });

    it("should sort tokens", async () => {
      const res = await req.get("/passport/refresh-token", {
        sort: JSON.stringify({created_at: -1})
      });
      expect(res.body).toEqual([
        {
          _id: "68399c56afa9a30634a8fefd",
          identity: "user2",
          created_at: "2000-01-01T12:00:00.000Z",
          expired_at: "2000-01-02T00:00:00.000Z",
          last_used_at: "2000-01-01T12:00:00.000Z"
        },
        {
          _id: "68399c4c347570ceac5d4806",
          identity: "user1",
          created_at: "2000-01-01T00:00:00.000Z",
          expired_at: "2000-01-02T00:00:00.000Z",
          last_used_at: "2000-01-01T00:00:00.000Z"
        }
      ]);
    });

    it("should filter tokens", async () => {
      const res = await req.get("/passport/refresh-token", {
        filter: JSON.stringify({identity: "user2"})
      });
      expect(res.body).toEqual([
        {
          _id: "68399c56afa9a30634a8fefd",
          identity: "user2",
          created_at: "2000-01-01T12:00:00.000Z",
          expired_at: "2000-01-02T00:00:00.000Z",
          last_used_at: "2000-01-01T12:00:00.000Z"
        }
      ]);
    });

    // K-13: the expression language on the same parameter, through `PipelineBuilder`'s `$match`.
    it("should filter tokens by an expression", async () => {
      const res = await req.get("/passport/refresh-token", {filter: 'identity == "user2"'});
      expect(res.body).toEqual([
        {
          _id: "68399c56afa9a30634a8fefd",
          identity: "user2",
          created_at: "2000-01-01T12:00:00.000Z",
          expired_at: "2000-01-02T00:00:00.000Z",
          last_used_at: "2000-01-01T12:00:00.000Z"
        }
      ]);
    });

    it("should paginate tokens", async () => {
      const res = await req.get("/passport/refresh-token", {
        paginate: true
      });
      expect(res.body).toEqual({
        meta: {total: 2},
        data: [
          {
            _id: "68399c4c347570ceac5d4806",
            identity: "user1",
            created_at: "2000-01-01T00:00:00.000Z",
            expired_at: "2000-01-02T00:00:00.000Z",
            last_used_at: "2000-01-01T00:00:00.000Z"
          },
          {
            _id: "68399c56afa9a30634a8fefd",
            identity: "user2",
            created_at: "2000-01-01T12:00:00.000Z",
            expired_at: "2000-01-02T00:00:00.000Z",
            last_used_at: "2000-01-01T12:00:00.000Z"
          }
        ]
      });
    });
  });

  describe("findOne", () => {
    it("should get specific token without sensitive fields", async () => {
      const res = await req.get("/passport/refresh-token/68399c4c347570ceac5d4806");
      expect(res.body).toEqual({
        _id: "68399c4c347570ceac5d4806",
        identity: "user1",
        created_at: "2000-01-01T00:00:00.000Z",
        expired_at: "2000-01-02T00:00:00.000Z",
        last_used_at: "2000-01-01T00:00:00.000Z"
      });
    });

    it("should throw not found exception if token does not exist", async () => {
      const res = await req.get("/passport/refresh-token/000000000000000000000000");
      expect(res.statusCode).toEqual(404);
      expect(res.body).toEqual({
        statusCode: 404,
        message: "Not Found"
      });
    });
  });

  describe("delete", () => {
    it("should delete token", async () => {
      let res = await req.delete("/passport/refresh-token/68399c4c347570ceac5d4806");
      expect(res.statusCode).toEqual(204);

      res = await req.get("/passport/refresh-token/68399c4c347570ceac5d4806");
      expect(res.statusCode).toEqual(404);
      expect(res.body).toEqual({
        statusCode: 404,
        message: "Not Found"
      });
    });

    it("should throw not found exception if token does not exist", async () => {
      const res = await req.delete("/passport/refresh-token/000000000000000000000000");
      expect(res.statusCode).toEqual(404);
      expect(res.body).toEqual({
        statusCode: 404,
        message: "Not Found"
      });
    });
  });

  describe("update", () => {
    it("should disable token", async () => {
      const res = await req.put("/passport/refresh-token/68399c4c347570ceac5d4806", {
        disabled: true
      });
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual({
        _id: "68399c4c347570ceac5d4806",
        identity: "user1",
        created_at: "2000-01-01T00:00:00.000Z",
        expired_at: "2000-01-02T00:00:00.000Z",
        last_used_at: "2000-01-01T00:00:00.000Z",
        disabled: true
      });
    });

    it("should enable token", async () => {
      const res = await req.put("/passport/refresh-token/68399c4c347570ceac5d4806", {
        disabled: false
      });
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual({
        _id: "68399c4c347570ceac5d4806",
        identity: "user1",
        created_at: "2000-01-01T00:00:00.000Z",
        expired_at: "2000-01-02T00:00:00.000Z",
        last_used_at: "2000-01-01T00:00:00.000Z",
        disabled: false
      });
    });

    it("should throw not found exception if token does not exist", async () => {
      const res = await req.put("/passport/refresh-token/000000000000000000000000", {
        disabled: false
      });
      expect(res.statusCode).toEqual(404);
      expect(res.body).toEqual({
        statusCode: 404,
        message: "Not Found"
      });
    });

    it("should ignore updates for fields other than disabled", async () => {
      const res = await req.put("/passport/refresh-token/68399c4c347570ceac5d4806", {
        user: "random_user",
        created_at: "2004-10-08T21:00:00.000Z",
        disabled: true
      });
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual({
        _id: "68399c4c347570ceac5d4806",
        identity: "user1",
        created_at: "2000-01-01T00:00:00.000Z",
        expired_at: "2000-01-02T00:00:00.000Z",
        last_used_at: "2000-01-01T00:00:00.000Z",
        disabled: true
      });
    });

    it("should throw error if disabled is not boolean", async () => {
      const res = await req.put("/passport/refresh-token/68399c4c347570ceac5d4806", {
        disabled: "true"
      });
      expect(res.statusCode).toEqual(400);
      expect(res.body).toEqual({
        statusCode: 400,
        error: "Bad Request",
        message: "Only disabled field can be updated and it must be a boolean"
      });
    });

    it("should throw error if some fields are trying to be updated rather then disabled", async () => {
      const res = await req.put("/passport/refresh-token/68399c4c347570ceac5d4806", {
        user: "user_someone"
      });
      expect(res.statusCode).toEqual(400);
      expect(res.body).toEqual({
        statusCode: 400,
        error: "Bad Request",
        message: "Only disabled field can be updated and it must be a boolean"
      });
    });
  });
});

describe("RefreshToken with hash secret", () => {
  const HASH_SECRET = "test_refresh_token_hash_secret";
  const TOKEN_EXPIRES_IN = 1 * 24 * 60 * 60;

  let req: Request;
  let app: INestApplication;
  let service: RefreshTokenService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        DatabaseTestingModule.standalone(),
        CoreTestingModule,
        PassportTestingModule.initialize(),
        RefreshTokenModule.forRoot({
          expiresIn: TOKEN_EXPIRES_IN,
          realtime: false,
          refreshTokenHashSecret: HASH_SECRET
        }),
        SchemaModule.forRoot({formats: [OBJECT_ID]})
      ]
    }).compile();

    req = module.get(Request);
    service = module.get(RefreshTokenService);
    app = module.createNestApplication();
    await app.listen(req.socket);
  });

  afterEach(() => app.close());

  it("should hash filter token value before querying", async () => {
    const rawToken = "my_raw_refresh_token";
    const hashedToken = hash(rawToken, HASH_SECRET);
    await service.insertOne({
      _id: new ObjectId("aaa00000000000000000000a"),
      identity: "user1",
      token: hashedToken,
      created_at: new Date("2000-01-01T00:00:00.000Z"),
      expired_at: new Date("2099-01-01T00:00:00.000Z"),
      last_used_at: new Date("2000-01-01T00:00:00.000Z")
    });

    const res = await req.get("/passport/refresh-token", {
      filter: JSON.stringify({token: rawToken})
    });

    expect(res.body.length).toEqual(1);
    expect(res.body[0]).toEqual({
      _id: "aaa00000000000000000000a",
      identity: "user1",
      created_at: "2000-01-01T00:00:00.000Z",
      expired_at: "2099-01-01T00:00:00.000Z",
      last_used_at: "2000-01-01T00:00:00.000Z"
    });
  });

  it("hash filter should work with token value using $in operator", async () => {
    const rawToken = "my_raw_refresh_token";
    const hashedToken = hash(rawToken, HASH_SECRET);
    await service.insertOne({
      _id: new ObjectId("aaa00000000000000000000a"),
      identity: "user1",
      token: hashedToken,
      created_at: new Date("2000-01-01T00:00:00.000Z"),
      expired_at: new Date("2099-01-01T00:00:00.000Z"),
      last_used_at: new Date("2000-01-01T00:00:00.000Z")
    });

    const res = await req.get("/passport/refresh-token", {
      filter: JSON.stringify({token: {$in: [rawToken]}})
    });

    expect(res.body.length).toEqual(1);
    expect(res.body[0]._id).toEqual("aaa00000000000000000000a");
    expect(res.body[0].token).toBeUndefined();
  });

  it("hash filter should work with token value using $or operator", async () => {
    const rawToken = "my_raw_refresh_token";
    const hashedToken = hash(rawToken, HASH_SECRET);
    await service.insertOne({
      _id: new ObjectId("aaa00000000000000000000a"),
      identity: "user1",
      token: hashedToken,
      created_at: new Date("2000-01-01T00:00:00.000Z"),
      expired_at: new Date("2099-01-01T00:00:00.000Z"),
      last_used_at: new Date("2000-01-01T00:00:00.000Z")
    });

    const res = await req.get("/passport/refresh-token", {
      filter: JSON.stringify({$or: [{token: rawToken}]})
    });

    expect(res.body.length).toEqual(1);
    expect(res.body[0]._id).toEqual("aaa00000000000000000000a");
    expect(res.body[0].token).toBeUndefined();
  });

  it("should not match when filter token does not correspond to stored hash", async () => {
    const hashedToken = hash("real_token", HASH_SECRET);

    await service.insertOne({
      _id: new ObjectId("bbb00000000000000000000b"),
      identity: "user1",
      token: hashedToken,
      created_at: new Date("2000-01-01T00:00:00.000Z"),
      expired_at: new Date("2099-01-01T00:00:00.000Z"),
      last_used_at: new Date("2000-01-01T00:00:00.000Z")
    });

    const res = await req.get("/passport/refresh-token", {
      filter: JSON.stringify({token: "wrong_token"})
    });

    expect(res.body.length).toEqual(0);
  });
});
