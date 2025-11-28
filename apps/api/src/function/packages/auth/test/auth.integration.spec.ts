import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {SchemaModule} from "@spica-server/core/schema";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {CoreTestingModule} from "@spica-server/core/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {PassportModule} from "@spica-server/passport";
import * as Auth from "@spica-devkit/auth";
import Axios from "axios";
import {jwtDecode} from "jwt-decode";
import {BatchModule} from "@spica-server/batch";

const EXPIRES_IN = 60 * 60 * 24;
const MAX_EXPIRES_IN = EXPIRES_IN * 2;
const REFRESH_TOKEN_EXPIRES_IN = 60 * 60 * 24 * 3;

const PORT = 3000;
const PUBLIC_URL = `http://localhost:${PORT}`;

describe("Auth", () => {
  let module: TestingModule;
  let app: INestApplication;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        SchemaModule.forRoot(),
        DatabaseTestingModule.replicaSet(),
        PassportModule.forRoot({
          publicUrl: PUBLIC_URL,
          defaultStrategy: "IDENTITY",
          samlCertificateTTL: EXPIRES_IN,
          apikeyRealtime: false,
          refreshTokenRealtime: false,
          policyRealtime: false,
          identityOptions: {
            expiresIn: EXPIRES_IN,
            maxExpiresIn: MAX_EXPIRES_IN,
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
            refreshTokenExpiresIn: REFRESH_TOKEN_EXPIRES_IN,
            passwordHistoryLimit: 0,
            identityRealtime: false
          },
          userOptions: {
            expiresIn: EXPIRES_IN,
            maxExpiresIn: MAX_EXPIRES_IN,
            issuer: "spica",
            secretOrKey: "spica",
            audience: "spica",
            defaultUserUsername: "spica",
            defaultUserPassword: "spica",
            defaultUserPolicies: ["PassportFullAccess"],
            blockingOptions: {
              blockDurationMinutes: 0,
              failedAttemptLimit: 0
            },
            refreshTokenExpiresIn: REFRESH_TOKEN_EXPIRES_IN,
            passwordHistoryLimit: 0,
            userRealtime: false
          }
        }),
        PreferenceTestingModule,
        CoreTestingModule,
        BatchModule.forRoot({port: PORT.toString()})
      ]
    }).compile();
    app = module.createNestApplication();
    await app.listen(PORT);

    // WAIT UNTIL USER IS INSERTED
    await new Promise((resolve, _) => setTimeout(resolve, 3000));

    const token = await Axios.post(`${PUBLIC_URL}/passport/identify`, {
      identifier: "spica",
      password: "spica"
    }).then(r => r.data.token);

    Auth.initialize({identity: token, publicUrl: PUBLIC_URL});
  });

  afterEach(async () => await app.close());

  describe("login", () => {
    beforeEach(async () => {
      await Auth.signUp({
        username: "user1",
        password: "pass1",
        policies: ["PassportFullAccess"]
      });
    });
    it("should sign in", async () => {
      const token = await Auth.signIn("user1", "pass1");
      const {username, iat, exp, iss} = jwtDecode<any>(token);

      expect([username, iss]).toEqual(["user1", "spica"]);

      const tokenLifeSpan = exp - iat;
      expect(tokenLifeSpan).toEqual(EXPIRES_IN);
    });

    it("should sign in with desired token lifespan", async () => {
      const oneDay = 60 * 60 * 24;
      const token = await Auth.signIn("user1", "pass1", oneDay);

      const {iat, exp} = jwtDecode<any>(token);

      const tokenLifeSpan = exp - iat;
      expect(tokenLifeSpan).toEqual(oneDay);
    });

    it("should verify token with success", async () => {
      const token = await Auth.signIn("user1", "pass1");

      const decodedToken = jwtDecode<any>(token);

      const result = await Auth.verifyToken(token);
      expect(result).toEqual(decodedToken);
    });

    it("should verify token with failure", async () => {
      const result = await Auth.verifyToken("some_invalid_token").catch(e => e);
      expect(result).toEqual({
        statusCode: 400,
        message: "jwt malformed",
        error: "Bad Request"
      });
    });
  });

  describe("user", () => {
    it("should sign up", async () => {
      const user = await Auth.signUp({
        username: "user1",
        password: "pass1",
        policies: ["PassportFullAccess"]
      });

      expect(ObjectId.isValid(user._id)).toEqual(true);
      expect(user).toEqual({
        _id: user._id,
        username: "user1",
        policies: ["PassportFullAccess"]
      });

      const token = await Auth.signIn("user1", "pass1");
      const {username, policies} = jwtDecode<any>(token);

      expect(username).toEqual("user1");
      expect(policies).toEqual(["PassportFullAccess"]);
    });

    it("should sign up with multiple policies", async () => {
      const user = await Auth.signUp({
        username: "user2",
        password: "pass2",
        policies: ["PassportFullAccess", "BucketFullAccess"]
      });

      expect(ObjectId.isValid(user._id)).toEqual(true);
      expect(user.username).toEqual("user2");
      expect(user.policies.sort((a, b) => a.localeCompare(b))).toEqual([
        "BucketFullAccess",
        "PassportFullAccess"
      ]);
    });

    it("should sign up with headers", async () => {
      const user = await Auth.signUp(
        {
          username: "user3",
          password: "pass3",
          policies: []
        },
        {Accept: "application/json"}
      );

      expect(ObjectId.isValid(user._id)).toEqual(true);
      expect(user.username).toEqual("user3");
    });

    describe("policies", () => {
      it("should attach policy", async () => {
        const user = await Auth.signUp({
          username: "user4",
          password: "pass4",
          policies: []
        });

        const res = await Auth.policy.attach(user._id, ["FunctionFullAccess"]);
        expect(res).toEqual(["FunctionFullAccess"]);
      });

      it("should detach policy", async () => {
        const user = await Auth.signUp({
          username: "user5",
          password: "pass5",
          policies: ["FunctionFullAccess"]
        });

        const res = await Auth.policy.detach(user._id, ["FunctionFullAccess"]);
        expect(res).toEqual(["FunctionFullAccess"]);
      });

      it("should attach multiple policies", async () => {
        const user = await Auth.signUp({
          username: "user6",
          password: "pass6",
          policies: []
        });

        const res = await Auth.policy.attach(user._id, ["FunctionFullAccess", "BucketFullAccess"]);

        expect(res.sort((a, b) => a.localeCompare(b))).toEqual([
          "BucketFullAccess",
          "FunctionFullAccess"
        ]);
      });

      it("should detach multiple policies", async () => {
        const user = await Auth.signUp({
          username: "user7",
          password: "pass7",
          policies: ["FunctionFullAccess", "BucketFullAccess"]
        });

        const res = await Auth.policy.detach(user._id, ["FunctionFullAccess", "BucketFullAccess"]);

        expect(res.sort((a, b) => a.localeCompare(b))).toEqual([
          "BucketFullAccess",
          "FunctionFullAccess"
        ]);
      });
    });
  });
});
