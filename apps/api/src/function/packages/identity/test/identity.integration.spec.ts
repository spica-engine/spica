import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {SchemaModule} from "@spica/core";
import {DatabaseTestingModule} from "@spica/database";
import {CoreTestingModule} from "@spica/core";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {PassportModule} from "@spica-server/passport";
import * as Identity from "@spica-devkit/identity";
import Axios from "axios";
import jwt_decode from "jwt-decode";

jasmine.DEFAULT_TIMEOUT_INTERVAL = 20_000;
const EXPIRES_IN = 60 * 60 * 24;
const MAX_EXPIRES_IN = EXPIRES_IN * 2;

const PORT = 3000;
const PUBLIC_URL = `http://localhost:${PORT}`;

describe("Identity", () => {
  let module: TestingModule;
  let app: INestApplication;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        SchemaModule.forRoot(),
        DatabaseTestingModule.replicaSet(),
        PassportModule.forRoot({
          expiresIn: EXPIRES_IN,
          issuer: "spica",
          maxExpiresIn: MAX_EXPIRES_IN,
          publicUrl: PUBLIC_URL,
          samlCertificateTTL: EXPIRES_IN,
          secretOrKey: "spica",
          defaultStrategy: "IDENTITY",
          defaultIdentityIdentifier: "spica",
          defaultIdentityPassword: "spica",
          audience: "spica",
          defaultIdentityPolicies: ["PassportFullAccess"]
        }),
        PreferenceTestingModule,
        CoreTestingModule
      ]
    }).compile();
    app = module.createNestApplication();
    await app.listen(PORT);

    // WAIT UNTIL IDENTITY IS INSERTED
    await new Promise((resolve, _) => setTimeout(resolve, 3000));

    const token = await Axios.post(`${PUBLIC_URL}/passport/identify`, {
      identifier: "spica",
      password: "spica"
    }).then(r => r.data.token);

    Identity.initialize({identity: token, publicUrl: PUBLIC_URL});

    jasmine.addCustomEqualityTester((actual, expected) => {
      if (expected == "__objectid__" && typeof actual == typeof expected) {
        return true;
      }
    });
  });

  afterEach(async () => await app.close());

  describe("login", () => {
    it("should login", async () => {
      const token = await Identity.login("spica", "spica");
      const {identifier, iat, exp, iss} = jwt_decode<any>(token);

      expect([identifier, iss]).toEqual(["spica", "spica"]);

      const tokenLifeSpan = exp - iat;
      expect(tokenLifeSpan).toEqual(EXPIRES_IN);
    });

    it("should login with desired token lifespan", async () => {
      const oneDay = 60 * 60 * 24;
      const token = await Identity.login("spica", "spica", oneDay);

      const {iat, exp} = jwt_decode<any>(token);

      const tokenLifeSpan = exp - iat;
      expect(tokenLifeSpan).toEqual(oneDay);
    });

    it("should verify token with success", async () => {
      const token = await Identity.login("spica", "spica");

      const decodedToken = jwt_decode<any>(token);

      const result = await Identity.verifyToken(token);
      expect(result).toEqual(decodedToken);
    });

    it("should verify token with failure", async () => {
      const result = await Identity.verifyToken("some_invalid_token").catch(e => e);
      expect(result).toEqual({
        statusCode: 400,
        message: "jwt malformed",
        error: "Bad Request"
      });
    });
  });

  // login with strategy

  describe("identity", () => {
    it("should get all", async () => {
      const identities = await Identity.getAll();
      expect(identities).toEqual([
        {identifier: "spica", _id: "__objectid__", policies: ["PassportFullAccess"]}
      ]);
    });

    describe("get", () => {
      it("should get", async () => {
        const identities = await Identity.getAll();

        const spica = await Identity.get(identities[0]._id);
        expect(spica).toEqual({
          _id: "__objectid__",
          identifier: "spica",
          policies: ["PassportFullAccess"]
        });
      });

      it("should get with paginate", async () => {
        const identities = await Identity.getAll({paginate: true});
        expect(identities).toEqual({
          meta: {total: 1},
          data: [{identifier: "spica", _id: "__objectid__", policies: ["PassportFullAccess"]}]
        });
      });

      it("should get with limit", async () => {
        await Identity.insert({identifier: "user", password: "pass", policies: []});
        const identities = await Identity.getAll({limit: 1});
        expect(identities).toEqual([
          {
            _id: "__objectid__",
            identifier: "spica",
            policies: ["PassportFullAccess"]
          }
        ]);
      });

      it("should get with skip", async () => {
        await Identity.insert({identifier: "user", password: "pass", policies: []});
        const identities = await Identity.getAll({skip: 1});
        expect(identities).toEqual([
          {
            _id: "__objectid__",
            identifier: "user",
            policies: []
          }
        ]);
      });

      it("should get with sort", async () => {
        await Identity.insert({identifier: "user", password: "pass", policies: []});
        const identities = await Identity.getAll({
          sort: {
            _id: -1
          }
        });
        expect(identities).toEqual([
          {
            _id: "__objectid__",
            identifier: "user",
            policies: []
          },
          {
            _id: "__objectid__",
            identifier: "spica",
            policies: ["PassportFullAccess"]
          }
        ]);
      });

      it("should get with filter", async () => {
        await Identity.insert({identifier: "user", password: "pass", policies: []});
        const identities = await Identity.getAll({
          filter: {
            identifier: "user"
          }
        });
        expect(identities).toEqual([{_id: "__objectid__", identifier: "user", policies: []}]);
      });
    });

    it("should insert", async () => {
      const identity = await Identity.insert({
        identifier: "user1",
        password: "pass1",
        policies: ["BucketFullAccess"]
      });

      expect(identity).toEqual({
        _id: "__objectid__",
        identifier: "user1",
        policies: ["BucketFullAccess"]
      });

      const token = await Identity.login("user1", "pass1");
      const {identifier, policies} = jwt_decode<any>(token);

      expect(identifier).toEqual("user1");
      expect(policies).toEqual(["BucketFullAccess"]);
    });

    it("should update", async () => {
      const identity = await Identity.insert({
        identifier: "user1",
        password: "pass1",
        policies: ["BucketReadonlyAccess"]
      });

      await Identity.update(identity._id, {
        identifier: "user1",
        password: "pass2",
        policies: ["WebhookReadonlyAccess", "FunctionReadonlyAccess"]
      });

      await Identity.login("user1", "pass1").catch(e => {
        expect(e).toEqual({
          statusCode: 401,
          message: "Identifier or password was incorrect.",
          error: "Unauthorized"
        });
      });

      const token = await Identity.login("user1", "pass2");

      const {identifier, policies} = jwt_decode<any>(token);

      expect(identifier).toEqual("user1");
      expect(policies.sort((a, b) => a.localeCompare(b))).toEqual([
        "FunctionReadonlyAccess",
        "WebhookReadonlyAccess"
      ]);
    });

    it("should remove", async () => {
      const identity = await Identity.insert({
        identifier: "user1",
        password: "pass1",
        policies: ["BucketReadonlyAccess"]
      });

      await Identity.remove(identity._id);

      const identities = await Identity.getAll();

      expect(identities).toEqual([
        {identifier: "spica", _id: "__objectid__", policies: ["PassportFullAccess"]}
      ]);
    });

    describe("policies", () => {
      it("should attach", async () => {
        let identity = await Identity.insert({
          identifier: "user",
          password: "pass",
          policies: []
        });
        const res = await Identity.policy.attach(identity._id, ["FunctionFullAccess"]);
        expect(res).toEqual(["FunctionFullAccess"]);

        identity = await Identity.get(identity._id);
        expect(identity).toEqual({
          _id: "__objectid__",
          identifier: "user",
          policies: ["FunctionFullAccess"]
        });
      });

      it("should detach", async () => {
        let identity = await Identity.insert({
          identifier: "user",
          password: "pass",
          policies: ["FunctionFullAccess"]
        });
        const res = await Identity.policy.detach(identity._id, ["FunctionFullAccess"]);
        expect(res).toEqual(["FunctionFullAccess"]);

        identity = await Identity.get(identity._id);
        expect(identity).toEqual({
          _id: "__objectid__",
          identifier: "user",
          policies: []
        });
      });
    });
  });
});
