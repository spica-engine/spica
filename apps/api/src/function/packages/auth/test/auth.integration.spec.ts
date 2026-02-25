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
import cookieParser from "cookie-parser";
import {DATE_TIME, OBJECT_ID} from "@spica-server/core/schema/formats";
import {MailerModule} from "@spica-server/mailer";
import {UserConfigService} from "@spica-server/passport/user/src/config.service";
import {GenericContainer} from "testcontainers";
import fetch from "node-fetch";
import {ConfigModule} from "@spica-server/config/src/config.module";

const EXPIRES_IN = 60 * 60 * 24;
const MAX_EXPIRES_IN = EXPIRES_IN * 2;
const REFRESH_TOKEN_EXPIRES_IN = 60 * 60 * 24 * 3;
const REFRESH_TOKEN_HASH_SECRET = "refresh_token_hash_secret";

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
        ConfigModule.forRoot(),
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
            refreshTokenHashSecret: REFRESH_TOKEN_HASH_SECRET,
            passwordHistoryLimit: 0,
            identityRealtime: false
          },
          userOptions: {
            expiresIn: EXPIRES_IN,
            maxExpiresIn: MAX_EXPIRES_IN,
            issuer: "spica",
            secretOrKey: "spica",
            audience: "spica",
            blockingOptions: {
              blockDurationMinutes: 0,
              failedAttemptLimit: 0
            },
            refreshTokenExpiresIn: REFRESH_TOKEN_EXPIRES_IN,
            refreshTokenHashSecret: REFRESH_TOKEN_HASH_SECRET,
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
    app.use(cookieParser());
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
    it("should update username", async () => {
      const auth = await importFreshAuthModule();
      auth.initialize({identity: token, publicUrl: PUBLIC_URL});

      const user = await auth.signUp({
        username: "testuser",
        password: "testpass"
      });

      const updatedUser = await auth.updateUsername(user._id, "updatedusername");

      expect(updatedUser._id).toEqual(user._id);
      expect(updatedUser.username).toEqual("updatedusername");

      const signInToken = await auth.signIn("updatedusername", "testpass");
      const decodedToken = jwtDecode<any>(signInToken);

      expect(decodedToken.username).toEqual("updatedusername");
    });

    it("should ban user", async () => {
      const auth = await importFreshAuthModule();
      auth.initialize({identity: token, publicUrl: PUBLIC_URL});

      const user = await auth.signUp({
        username: "banneduser",
        password: "testpass"
      });

      const banDate = new Date();
      banDate.setDate(banDate.getDate() + 1);

      const updatedUser = await auth.ban(user._id, banDate);

      expect(updatedUser._id).toEqual(user._id);
      expect(updatedUser.username).toEqual("banneduser");

      const error = await auth.signIn("banneduser", "testpass").catch(e => e);
      expect(error.statusCode).toEqual(401);
      expect(error.message).toContain("User is banned");
    });

    it("should deactivate user tokens", async () => {
      const auth = await importFreshAuthModule();
      auth.initialize({identity: token, publicUrl: PUBLIC_URL});

      const user = await auth.signUp({
        username: "tokenuser",
        password: "testpass"
      });

      const oldToken = await auth.signIn("tokenuser", "testpass");
      const oldDecodedToken = jwtDecode<any>(oldToken);

      expect(oldDecodedToken.username).toEqual("tokenuser");

      const date = new Date();
      const deactivateDate = new Date(date.getTime() + 10 * 1000);

      const updatedUser = await auth.deactivateUserTokens(user._id, deactivateDate);
      expect(updatedUser._id).toEqual(user._id);

      const authWithOldToken = await importFreshAuthModule();
      authWithOldToken.initialize({user: oldToken, publicUrl: PUBLIC_URL});

      const error = await authWithOldToken.get(user._id).catch(e => e);
      expect(error).toBeDefined();
      expect(error.statusCode).toEqual(400);
      expect(error.message).toContain("Invalid JWT");
    });

    it("should fail to update username with USER token", async () => {
      const authWithIdentity = await importFreshAuthModule();
      authWithIdentity.initialize({identity: token, publicUrl: PUBLIC_URL});

      const user = await authWithIdentity.signUp({
        username: "testuser2",
        password: "testpass2"
      });

      const userToken = await authWithIdentity.signIn("testuser2", "testpass2");

      const authWithUserToken = await importFreshAuthModule();
      authWithUserToken.initialize({user: userToken, publicUrl: PUBLIC_URL});

      const error = await authWithUserToken.updateUsername(user._id, "shouldnotwork").catch(e => e);

      expect(error).toBeDefined();
      expect(error.statusCode).toEqual(401);

      const unchangedUser = await authWithIdentity.get(user._id);
      expect(unchangedUser.username).toEqual("testuser2");
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

  describe("refreshAccessToken", () => {
    let auth;
    let userToken: string;
    let shortLivedToken: string;
    let shortLivedCookies: string[];

    beforeEach(async () => {
      auth = await importFreshAuthModule();
      auth.initialize({identity: token, publicUrl: PUBLIC_URL});

      await auth.signUp({
        username: "refresh_user",
        password: "refresh_pass"
      });

      const [loginResponse, shortLivedResponse] = await Promise.all([
        Axios.post(`${PUBLIC_URL}/passport/login`, {
          username: "refresh_user",
          password: "refresh_pass"
        }),
        Axios.post(`${PUBLIC_URL}/passport/login`, {
          username: "refresh_user",
          password: "refresh_pass",
          expires: 1
        })
      ]);

      userToken = loginResponse.data.token;
      shortLivedToken = shortLivedResponse.data.token;
      shortLivedCookies = shortLivedResponse.headers["set-cookie"];
    });

    afterEach(() => {
      jest.resetModules();
    });

    it("should fail refresh without cookies", async () => {
      const error = await auth.refreshAccessToken(`USER ${userToken}`).catch(e => e);

      expect(error.statusCode).toEqual(401);
      expect(error.message).toContain("Refresh token does not exist");
    });

    it("should refresh expired access token with valid refresh token", async () => {
      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 2000));

      const verifyError = await auth.verifyToken(shortLivedToken).catch(e => e);
      expect(verifyError.message).toContain("jwt expired");

      const newToken = await auth.refreshAccessToken(`USER ${shortLivedToken}`, {
        Cookie: shortLivedCookies.join("; ")
      });

      expect(newToken).toBeDefined();

      const verifiedUser = await auth.verifyToken(newToken);
      expect(verifiedUser.username).toEqual("refresh_user");
    });
  });
});

const VERIFICATION_PORT = 3004;
const VERIFICATION_PUBLIC_URL = `http://localhost:${VERIFICATION_PORT}`;

async function extractOtpFromMailHog(mailhogApiUrl: string): Promise<string> {
  const resp = await fetch(`${mailhogApiUrl}/api/v2/messages`);
  const body: any = await resp.json();

  if (!body.total || body.total === 0) {
    throw new Error("No messages found in MailHog");
  }

  const item: any = body.items[0];
  const raw =
    item.Raw && item.Raw.Data
      ? item.Raw.Data
      : item.Content && item.Content.Body
        ? item.Content.Body
        : "";

  const codeMatch = raw.match(/is: (\d{6})/);
  if (!codeMatch) throw new Error(`Could not extract OTP from MailHog message. Raw: ${raw}`);
  return codeMatch[1];
}

async function clearMailHogMessages(mailhogApiUrl: string): Promise<void> {
  try {
    await fetch(`${mailhogApiUrl}/api/v1/messages`, {method: "DELETE"});
  } catch (e) {
    console.warn("Failed to clear MailHog messages:", e);
  }
}

describe("auth verification flows", () => {
  let module: TestingModule;
  let app: INestApplication;
  let token: string;
  let userConfigService: UserConfigService;
  let container: any;
  let smtpPort: number;
  let mailhogApiPort: number;
  let smtpHost: string;
  let mailhogApiUrl: string;

  beforeAll(async () => {
    const mailerUrl = process.env.MAILER_URL;

    if (mailerUrl) {
      const [smtpUrl, apiUrl] = mailerUrl.split(",");
      const smtpParts = smtpUrl.split("://")[1].split(":");
      const apiParts = apiUrl.split("://")[1].split(":");

      smtpHost = smtpParts[0];
      smtpPort = parseInt(smtpParts[1]);
      const apiHost = apiParts[0];
      mailhogApiPort = parseInt(apiParts[1]);
      mailhogApiUrl = `http://${apiHost}:${mailhogApiPort}`;
    } else {
      try {
        container = await new GenericContainer("mailhog/mailhog")
          .withExposedPorts(1025, 8025)
          .start();
        smtpHost = container.getHost();
        smtpPort = container.getMappedPort(1025);
        mailhogApiPort = container.getMappedPort(8025);
        mailhogApiUrl = `http://${smtpHost}:${mailhogApiPort}`;
      } catch (e) {
        console.error("Failed to start MailHog container:", e);
        throw e;
      }
    }
  }, 60000);

  afterAll(async () => {
    if (container) await container.stop();
  });

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        SchemaModule.forRoot({
          formats: [OBJECT_ID, DATE_TIME]
        }),
        DatabaseTestingModule.replicaSet(),
        PassportModule.forRoot({
          publicUrl: VERIFICATION_PUBLIC_URL,
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
            blockingOptions: {
              blockDurationMinutes: 0,
              failedAttemptLimit: 0
            },
            refreshTokenExpiresIn: REFRESH_TOKEN_EXPIRES_IN,
            passwordHistoryLimit: 0,
            userRealtime: false,
            verificationHashSecret: "3fe2e8060da06c70906096b43db6de11",
            providerEncryptionSecret: "3fe2e8060da06c70906096b43db6de11",
            providerHashSecret: "3fe2e8060da06c70906096b43db6de11",
            verificationCodeExpiresIn: 300
          }
        }),
        MailerModule.forRoot({
          host: smtpHost,
          port: smtpPort,
          secure: false,
          defaults: {
            from: "noreply@spica.internal"
          }
        }),
        PreferenceTestingModule,
        CoreTestingModule,
        BatchModule.forRoot({port: VERIFICATION_PORT.toString()})
      ]
    }).compile();

    app = module.createNestApplication();
    app.use(cookieParser());
    await app.listen(VERIFICATION_PORT);

    await new Promise((resolve, _) => setTimeout(resolve, 3000));

    token = await Axios.post(`${VERIFICATION_PUBLIC_URL}/passport/identify`, {
      identifier: "spica",
      password: "spica"
    }).then(r => r.data.token);

    userConfigService = module.get(UserConfigService);

    await userConfigService.set({
      verificationProcessMaxAttempt: 3
    });

    await userConfigService.updateProviderVerificationConfig([
      {provider: "email", strategy: "Otp"}
    ]);

    await userConfigService.updatePasswordlessLoginConfig({
      passwordlessLoginProvider: [{provider: "email", strategy: "Otp"}]
    });

    await userConfigService.updateResetPasswordConfig([{provider: "email", strategy: "Otp"}]);

    await clearMailHogMessages(mailhogApiUrl);
  });

  afterEach(async () => {
    await app.close();
  });

  describe("addEmail and verifyEmail", () => {
    let auth;
    let userId: string;

    beforeEach(async () => {
      auth = await importFreshAuthModule();
      auth.initialize({identity: token, publicUrl: VERIFICATION_PUBLIC_URL});

      const user = await auth.signUp({
        username: "emailuser",
        password: "emailpass"
      });
      userId = user._id;
    });

    afterEach(() => {
      jest.resetModules();
    });

    it("should add email and verify it with OTP", async () => {
      const startResult = await auth.addEmail(userId, "test@test.com", "Otp");

      expect(startResult.message).toBeDefined();

      const code = await extractOtpFromMailHog(mailhogApiUrl);

      const verifyResult = await auth.verifyEmail(userId, code, "Otp");

      expect(verifyResult.message).toBeDefined();
      expect(verifyResult.provider).toEqual("email");
    });

    it("should fail to verify email with wrong code", async () => {
      await auth.addEmail(userId, "test@test.com", "Otp");

      const error = await auth.verifyEmail(userId, "000000", "Otp").catch(e => e);

      expect(error).toBeDefined();
      expect(error.statusCode).toBeDefined();
    });
  });

  describe("requestPasswordReset and completePasswordReset", () => {
    let auth;

    beforeEach(async () => {
      auth = await importFreshAuthModule();
      auth.initialize({identity: token, publicUrl: VERIFICATION_PUBLIC_URL});

      const user = await auth.signUp({
        username: "resetuser",
        password: "oldpassword"
      });

      await auth.addEmail(user._id, "reset@test.com", "Otp");
      const emailCode = await extractOtpFromMailHog(mailhogApiUrl);
      await auth.verifyEmail(user._id, emailCode, "Otp");

      await clearMailHogMessages(mailhogApiUrl);
    });

    afterEach(() => {
      jest.resetModules();
    });

    it("should request and complete password reset", async () => {
      const startResult = await auth.requestPasswordReset("resetuser", "email");

      expect(startResult.message).toBeDefined();

      const code = await extractOtpFromMailHog(mailhogApiUrl);

      const completeResult = await auth.completePasswordReset(
        "resetuser",
        code,
        "newpassword123",
        "email"
      );

      expect(completeResult.message).toBeDefined();

      const signInToken = await auth.signIn("resetuser", "newpassword123");
      const decoded = jwtDecode<any>(signInToken);
      expect(decoded.username).toEqual("resetuser");
    });

    it("should fail to complete password reset with wrong code", async () => {
      await auth.requestPasswordReset("resetuser", "email");

      const error = await auth
        .completePasswordReset("resetuser", "000000", "newpassword123", "email")
        .catch(e => e);

      expect(error).toBeDefined();
      expect(error.statusCode).toBeDefined();
    });
  });

  describe("passwordlessLogin and completePasswordlessLogin", () => {
    let auth;

    beforeEach(async () => {
      auth = await importFreshAuthModule();
      auth.initialize({identity: token, publicUrl: VERIFICATION_PUBLIC_URL});

      const user = await auth.signUp({
        username: "passwordlessuser",
        password: "somepassword"
      });

      await auth.addEmail(user._id, "passwordless@test.com", "Otp");
      const emailCode = await extractOtpFromMailHog(mailhogApiUrl);
      await auth.verifyEmail(user._id, emailCode, "Otp");

      await clearMailHogMessages(mailhogApiUrl);
    });

    afterEach(() => {
      jest.resetModules();
    });

    it("should start and complete passwordless login", async () => {
      const startResult = await auth.passwordlessLogin("passwordlessuser", "email");

      expect(startResult.message).toBeDefined();

      const code = await extractOtpFromMailHog(mailhogApiUrl);

      const completeResult = await auth.completePasswordlessLogin(
        "passwordlessuser",
        code,
        "email"
      );

      expect(completeResult.token).toBeDefined();
      expect(completeResult.scheme).toBeDefined();
      expect(completeResult.issuer).toBeDefined();
      expect(completeResult.refreshToken).toBeDefined();

      const decoded = jwtDecode<any>(completeResult.token);
      expect(decoded.username).toEqual("passwordlessuser");
    });

    it("should fail passwordless login with wrong code", async () => {
      await auth.passwordlessLogin("passwordlessuser", "email");

      const error = await auth
        .completePasswordlessLogin("passwordlessuser", "000000", "email")
        .catch(e => e);

      expect(error).toBeDefined();
      expect(error.statusCode).toBeDefined();
    });

    it("should fail passwordless login for non-existent user", async () => {
      const error = await auth.passwordlessLogin("nonexistentuser", "email").catch(e => e);

      expect(error).toBeDefined();
      expect(error.statusCode).toBeDefined();
    });
  });
});
