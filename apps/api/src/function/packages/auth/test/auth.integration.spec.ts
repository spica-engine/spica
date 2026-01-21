import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {SchemaModule} from "@spica-server/core/schema";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {CoreTestingModule} from "@spica-server/core/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {PassportModule} from "@spica-server/passport";
import Axios from "axios";
import {jwtDecode} from "jwt-decode";
import {BatchModule} from "@spica-server/batch";
import {DATE_TIME, OBJECT_ID} from "@spica-server/core/schema/formats";

const EXPIRES_IN = 60 * 60 * 24;
const MAX_EXPIRES_IN = EXPIRES_IN * 2;
const REFRESH_TOKEN_EXPIRES_IN = 60 * 60 * 24 * 3;

const PORT = 3003;
const PUBLIC_URL = `http://localhost:${PORT}`;

async function importFreshAuthModule() {
  jest.resetModules();

  const now = new Date().getTime();
  const auth = await import(`@spica-devkit/auth?now=${now}"`);
  return auth;
}
describe("auth", () => {
  let module: TestingModule;
  let app: INestApplication;
  let token: string;
  let apiKeyId: string;
  let apikey: string;
  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        SchemaModule.forRoot({
          formats: [OBJECT_ID, DATE_TIME]
        }),
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

    await new Promise((resolve, _) => setTimeout(resolve, 3000));

    token = await Axios.post(`${PUBLIC_URL}/passport/identify`, {
      identifier: "spica",
      password: "spica"
    }).then(r => r.data.token);

    apiKeyId = await Axios.post(
      `${PUBLIC_URL}/passport/apikey`,
      {
        name: "test-apikey",
        description: "Test API Key"
      },
      {
        headers: {authorization: `IDENTITY ${token}`}
      }
    ).then(r => r.data._id);

    apikey = await Axios.put(
      `${PUBLIC_URL}/passport/apikey/${apiKeyId}/policy/PassportFullAccess`,
      undefined,
      {
        headers: {authorization: `IDENTITY ${token}`}
      }
    ).then(r => r.data.key);
  });

  afterEach(async () => {
    await app.close();
  });

  describe("sign in", () => {
    let auth;

    beforeEach(async () => {
      auth = await importFreshAuthModule();
      auth.initialize({identity: token, publicUrl: PUBLIC_URL});
      await auth.signUp({
        username: "user1",
        password: "pass1"
      });
    });

    afterEach(() => {
      jest.resetModules();
    });

    it("should sign in", async () => {
      const token = await auth.signIn("user1", "pass1");
      const {username, iat, exp, iss} = jwtDecode<any>(token);

      expect([username, iss]).toEqual(["user1", "spica"]);

      const tokenLifeSpan = exp - iat;
      expect(tokenLifeSpan).toEqual(EXPIRES_IN);
    });

    it("should sign in with desired token lifespan", async () => {
      const oneDay = 60 * 60 * 24;
      const token = await auth.signIn("user1", "pass1", oneDay);

      const {iat, exp} = jwtDecode<any>(token);

      const tokenLifeSpan = exp - iat;
      expect(tokenLifeSpan).toEqual(oneDay);
    });

    it("should verify token with success", async () => {
      const token = await auth.signIn("user1", "pass1");

      const decodedToken = jwtDecode<any>(token);

      const result = await auth.verifyToken(token);
      expect(result).toEqual(decodedToken);
    });

    it("should verify token with failure", async () => {
      const result = await auth.verifyToken("some_invalid_token").catch(e => e);
      expect(result).toEqual({
        statusCode: 400,
        message: "jwt malformed",
        error: "Bad Request"
      });
    });
  });

  describe("sign up", () => {
    let auth;

    beforeEach(async () => {
      auth = await importFreshAuthModule();
      auth.initialize({identity: token, publicUrl: PUBLIC_URL});
    });

    afterEach(() => {
      jest.resetModules();
    });

    it("should sign up", async () => {
      const user = await auth.signUp({
        username: "user1",
        password: "pass1"
      });

      expect(ObjectId.isValid(user._id)).toEqual(true);
      expect(user).toEqual({
        _id: user._id,
        username: "user1",
        policies: []
      });

      const token = await auth.signIn("user1", "pass1");
      const {username} = jwtDecode<any>(token);

      expect(username).toEqual("user1");
    });

    it("should sign up with headers", async () => {
      const user = await auth.signUp(
        {
          username: "user3",
          password: "pass3"
        },
        {Accept: "application/json"}
      );

      expect(ObjectId.isValid(user._id)).toEqual(true);
      expect(user.username).toEqual("user3");
    });
  });

  describe("crud operations", () => {
    let auth;
    let userId: string;
    beforeEach(async () => {
      auth = await importFreshAuthModule();
      auth.initialize({identity: token, publicUrl: PUBLIC_URL});
      const user = await auth.signUp({
        username: "updateuser",
        password: "oldpass"
      });
      userId = user._id;
    });

    afterEach(() => {
      jest.resetModules();
    });

    it("should update password", async () => {
      await auth.updatePassword(userId, {
        password: "newpass"
      });

      const newToken = await auth.signIn("updateuser", "newpass");
      const {username} = jwtDecode<any>(newToken);

      expect(username).toEqual("updateuser");
    });

    it("should get user by id", async () => {
      const user = await auth.get(userId);

      expect(user._id).toEqual(userId);
      expect(user.username).toEqual("updateuser");
    });
  });

  describe("verifyToken initialization", () => {
    let auth;

    beforeEach(async () => {
      auth = await importFreshAuthModule();
    });

    afterEach(() => {
      jest.resetModules();
    });

    it("should throw error when verifyToken is called without initialize", async () => {
      let error: any;
      try {
        await auth.verifyToken("any_token");
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error.message).toContain("You should call initialize method with a valid publicUrl.");
    });

    it("should work when initialize is called with identity", async () => {
      auth.initialize({publicUrl: PUBLIC_URL});

      const decodedToken = jwtDecode<any>(token);
      const result = await auth.verifyToken(token);

      expect(result).toEqual(decodedToken);
    });

    it("should verify provided token, not use identity from initialization", async () => {
      const auth2 = await importFreshAuthModule();
      auth2.initialize({identity: token, publicUrl: PUBLIC_URL});
      await auth2.signUp({
        username: "test_user",
        password: "test_pass"
      });
      const userToken = await auth2.signIn("test_user", "test_pass");

      auth.initialize({publicUrl: PUBLIC_URL});
      const userDecodedToken = jwtDecode<any>(userToken);

      const result = await auth.verifyToken(userToken);

      expect(result).toEqual(userDecodedToken);
      expect((result as any).username).toEqual("test_user");
    });
  });

  describe("verifyToken token scenarios", () => {
    let auth;
    let user1Token: string;
    let expiredToken: string;

    beforeEach(async () => {
      const authSetup = await importFreshAuthModule();
      authSetup.initialize({identity: token, publicUrl: PUBLIC_URL});
      await authSetup.signUp({
        username: "user1",
        password: "pass1"
      });
      user1Token = await authSetup.signIn("user1", "pass1");
      expiredToken = await authSetup.signIn("user1", "pass1", 1);

      auth = await importFreshAuthModule();
      auth.initialize({publicUrl: PUBLIC_URL});
    });

    afterEach(() => {
      jest.resetModules();
    });

    it("should throw error when verifyToken is called with a malformed token", async () => {
      const error: any = await auth.verifyToken("this_is_not_a_valid_token").catch(e => e);

      expect(error).toBeDefined();
      expect(error.message).toContain("jwt malformed");
    });

    it("should throw error when verifyToken is called with an expired token", async () => {
      //Wait 2 seconds to ensure the token is expired
      await new Promise((resolve, _) => setTimeout(resolve, 2000));

      const error: any = await auth.verifyToken(expiredToken).catch(e => e);

      expect(error).toBeDefined();
      expect(error.message).toContain("jwt expired");
    });

    it("should work when verifyToken is called with a valid token", async () => {
      const decodedToken = jwtDecode<any>(user1Token);

      const result = await auth.verifyToken(user1Token);

      expect(result).toEqual(decodedToken);
      expect((result as any).username).toEqual("user1");
    });
  });

  describe("signIn initialization", () => {
    let auth;

    beforeEach(async () => {
      auth = await importFreshAuthModule();
    });

    afterEach(() => {
      jest.resetModules();
    });

    it("should throw error when signIn is called without initialize", async () => {
      let error: any;
      try {
        await auth.signIn("user1", "pass1");
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error.message).toContain("You should call initialize method with a valid publicUrl.");
    });

    it("should work when initialize is called with apikey", async () => {
      auth.initialize({apikey: apikey, publicUrl: PUBLIC_URL});

      await auth.signUp({
        username: "signin_user1",
        password: "signin_pass1"
      });

      const signInToken = await auth.signIn("signin_user1", "signin_pass1");
      const decodedToken = jwtDecode<any>(signInToken);

      expect(decodedToken.username).toEqual("signin_user1");
    });

    it("should work when initialize is called with identity", async () => {
      auth.initialize({identity: token, publicUrl: PUBLIC_URL});

      await auth.signUp({
        username: "signin_user2",
        password: "signin_pass2"
      });

      const signInToken = await auth.signIn("signin_user2", "signin_pass2");
      const decodedToken = jwtDecode<any>(signInToken);

      expect(decodedToken.username).toEqual("signin_user2");
      expect(decodedToken.iss).toEqual("spica");
    });
  });
});
