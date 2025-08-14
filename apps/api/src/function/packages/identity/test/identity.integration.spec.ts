import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {SchemaModule} from "@spica-server/core/schema";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {CoreTestingModule} from "@spica-server/core/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {PassportModule} from "@spica-server/passport";
import * as Identity from "@spica-devkit/identity";
import Axios from "axios";
import {jwtDecode} from "jwt-decode";
import {BatchModule} from "@spica-server/batch";

const EXPIRES_IN = 60 * 60 * 24;
const MAX_EXPIRES_IN = EXPIRES_IN * 2;
const REFRESH_TOKEN_EXPIRES_IN = 60 * 60 * 24 * 3;

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
          refreshTokenExpiresIn: REFRESH_TOKEN_EXPIRES_IN,
          secretOrKey: "spica",
          defaultStrategy: "IDENTITY",
          defaultIdentityIdentifier: "spica",
          defaultIdentityPassword: "spica",
          audience: "spica",
          defaultIdentityPolicies: ["PassportFullAccess"],
          blockingOptions: {
            blockDurationMinutes: 0,
            failedAttemptLimit: 0
          },
          passwordHistoryLimit: 0,
          apikeyRealtime: false,
          policyRealtime: false,
          identityRealtime: false
        }),
        PreferenceTestingModule,
        CoreTestingModule,
        BatchModule.forRoot({port: PORT.toString()})
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
  });

  afterEach(async () => await app.close());

  describe("login", () => {
    it("should login", async () => {
      const token = await Identity.login("spica", "spica");
      const {identifier, iat, exp, iss} = jwtDecode<any>(token);

      expect([identifier, iss]).toEqual(["spica", "spica"]);

      const tokenLifeSpan = exp - iat;
      expect(tokenLifeSpan).toEqual(EXPIRES_IN);
    });

    it("should login with desired token lifespan", async () => {
      const oneDay = 60 * 60 * 24;
      const token = await Identity.login("spica", "spica", oneDay);

      const {iat, exp} = jwtDecode<any>(token);

      const tokenLifeSpan = exp - iat;
      expect(tokenLifeSpan).toEqual(oneDay);
    });

    it("should verify token with success", async () => {
      const token = await Identity.login("spica", "spica");

      const decodedToken = jwtDecode<any>(token);

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
      identities.forEach(i => delete i.lastLogin);
      expect(identities).toEqual([
        {
          identifier: "spica",
          _id: identities[0]._id,
          policies: ["PassportFullAccess"],
          failedAttempts: []
        }
      ]);
    });

    describe("get", () => {
      it("should get", async () => {
        const identities = await Identity.getAll();

        const spica = await Identity.get(identities[0]._id);
        delete spica.lastLogin;

        expect(spica).toEqual({
          _id: spica._id,
          identifier: "spica",
          policies: ["PassportFullAccess"],
          failedAttempts: []
        });
      });

      it("should get with paginate", async () => {
        const identities = await Identity.getAll({paginate: true});
        identities.data.forEach(i => delete i.lastLogin);
        expect(identities).toEqual({
          meta: {total: 1},
          data: [
            {
              identifier: "spica",
              _id: identities.data[0]._id,
              policies: ["PassportFullAccess"],
              failedAttempts: []
            }
          ]
        });
      });

      it("should get with limit", async () => {
        await Identity.insert({identifier: "user", password: "pass", policies: []});
        const identities = await Identity.getAll({limit: 1});
        identities.forEach(i => delete i.lastLogin);
        expect(identities).toEqual([
          {
            _id: identities[0]._id,
            identifier: "spica",
            policies: ["PassportFullAccess"],
            failedAttempts: []
          }
        ]);
      });

      it("should get with skip", async () => {
        await Identity.insert({identifier: "user", password: "pass", policies: []});
        const identities = await Identity.getAll({skip: 1});
        expect(identities).toEqual([
          {
            _id: identities[0]._id,
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

        delete identities[1].lastLogin;
        expect(identities).toEqual([
          {
            _id: identities[0]._id,
            identifier: "user",
            policies: []
          },
          {
            _id: identities[1]._id,
            identifier: "spica",
            policies: ["PassportFullAccess"],
            failedAttempts: []
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
        expect(identities).toEqual([{_id: identities[0]._id, identifier: "user", policies: []}]);
      });
    });

    it("should insert", async () => {
      const identity = await Identity.insert({
        identifier: "user1",
        password: "pass1",
        policies: ["BucketFullAccess"]
      });

      expect(ObjectId.isValid(identity._id)).toEqual(true);
      expect(identity).toEqual({
        _id: identity._id,
        identifier: "user1",
        policies: ["BucketFullAccess"]
      });

      const token = await Identity.login("user1", "pass1");
      const {identifier, policies} = jwtDecode<any>(token);

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

      const {identifier, policies} = jwtDecode<any>(token);

      expect(identifier).toEqual("user1");
      expect(policies.sort((a, b) => a.localeCompare(b))).toEqual([
        "FunctionReadonlyAccess",
        "WebhookReadonlyAccess"
      ]);
    });

    it("the sent policies should be returned", async () => {
      const identity = await Identity.insert({
        identifier: "user1",
        password: "pass1",
        policies: ["BucketReadonlyAccess"]
      });

      const updatedIdentity = await Identity.update(identity._id, {
        identifier: "user1",
        password: "pass1",
        policies: ["BucketReadonlyAccess", "FunctionReadonlyAccess"]
      });

      expect(updatedIdentity.identifier).toEqual("user1");
      expect(updatedIdentity.policies.sort((a, b) => a.localeCompare(b))).toEqual([
        "BucketReadonlyAccess",
        "FunctionReadonlyAccess"
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
      delete identities[0].lastLogin;

      expect(identities).toEqual([
        {
          identifier: "spica",
          _id: identities[0]._id,
          policies: ["PassportFullAccess"],
          failedAttempts: []
        }
      ]);
    });

    it("should remove multiple identities", async () => {
      let identities = await Promise.all([
        Identity.insert({
          identifier: "user1",
          password: "pass1",
          policies: ["BucketReadonlyAccess"]
        }),
        Identity.insert({
          identifier: "user2",
          password: "pass2",
          policies: ["BucketReadonlyAccess"]
        })
      ]);

      const response = await Identity.removeMany([...identities.map(i => i._id), "123"]);

      expect(response).toEqual({
        successes: [
          {
            request: `passport/identity/${identities[0]._id}`,
            response: ""
          },
          {
            request: `passport/identity/${identities[1]._id}`,
            response: ""
          }
        ],
        failures: [
          {
            request: `passport/identity/123`,
            response: {
              error: undefined,
              message: "Invalid id."
            }
          }
        ]
      });

      const existingIdentities = await Identity.getAll();
      delete existingIdentities[0].lastLogin;

      expect(existingIdentities).toEqual([
        {
          identifier: "spica",
          _id: existingIdentities[0]._id,
          policies: ["PassportFullAccess"],
          failedAttempts: []
        }
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
          _id: identity._id,
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
          _id: identity._id,
          identifier: "user",
          policies: []
        });
      });
    });
  });
});
