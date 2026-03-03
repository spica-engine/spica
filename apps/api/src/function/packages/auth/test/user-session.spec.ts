import * as Auth from "@spica-devkit/auth";
import {UserSession} from "@spica-devkit/auth";
import {Axios} from "@spica-devkit/internal_common";

describe("UserSession", () => {
  let getSpy: jest.SpyInstance;
  let postSpy: jest.SpyInstance;
  let putSpy: jest.SpyInstance;

  beforeEach(() => {
    getSpy = jest.spyOn(Axios.prototype, "get").mockImplementation((url: string) => {
      if (url.includes("/verify")) {
        return Promise.resolve({_id: "user_id_123", username: "testuser"});
      }
      return Promise.resolve({_id: "user_id_123", username: "testuser", policies: []});
    });
    postSpy = jest.spyOn(Axios.prototype, "post").mockImplementation((url: string) => {
      if (url.includes("/passport/login")) {
        return Promise.resolve({token: "test_token_abc"});
      }
      if (url.includes("/passwordless-login/verify")) {
        return Promise.resolve({
          token: "passwordless_token_xyz",
          scheme: "USER",
          issuer: "passport/user"
        });
      }
      if (url.includes("/session/refresh")) {
        return Promise.resolve({token: "refreshed_token_456"});
      }
      if (url.includes("/start-provider-verification")) {
        return Promise.resolve({
          message: "Verification started",
          value: "test@test.com",
          metadata: {}
        });
      }
      if (url.includes("/verify-provider")) {
        return Promise.resolve({
          message: "Verified",
          provider: "email",
          destination: "test@test.com"
        });
      }
      if (url.includes("/forgot-password/start")) {
        return Promise.resolve({message: "Password reset started"});
      }
      if (url.includes("/forgot-password/verify")) {
        return Promise.resolve({message: "Password reset completed"});
      }
      return Promise.resolve({});
    });
    putSpy = jest
      .spyOn(Axios.prototype, "put")
      .mockReturnValue(Promise.resolve({_id: "user_id_123", username: "testuser", policies: []}));

    process.env.__INTERNAL__SPICA__PUBLIC_URL__ = "http://test";
    Auth.initialize({apikey: "TEST_APIKEY"});
  });

  afterEach(() => {
    getSpy.mockClear();
    postSpy.mockClear();
    putSpy.mockClear();
  });

  describe("signIn returning UserSession", () => {
    it("should return a UserSession instance", async () => {
      const session = await Auth.signIn("testuser", "testpass");

      expect(session).toBeInstanceOf(UserSession);
    });

    it("should expose token via getter", async () => {
      const session = await Auth.signIn("testuser", "testpass");

      expect(session.token).toBe("test_token_abc");
    });

    it("should expose userId", async () => {
      const session = await Auth.signIn("testuser", "testpass");

      expect(session.userId).toBe("user_id_123");
    });

    it("should expose username", async () => {
      const session = await Auth.signIn("testuser", "testpass");

      expect(session.username).toBe("testuser");
    });

    it("should call login endpoint then verify endpoint", async () => {
      await Auth.signIn("testuser", "testpass");

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(
        "/passport/login",
        {username: "testuser", password: "testpass", expires: undefined},
        {headers: undefined}
      );

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith("passport/user/verify", {
        headers: {Authorization: "test_token_abc"}
      });
    });

    it("should pass tokenLifeSpan to login endpoint", async () => {
      await Auth.signIn("testuser", "testpass", 3600);

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(
        "/passport/login",
        {username: "testuser", password: "testpass", expires: 3600},
        {headers: undefined}
      );
    });

    it("should pass custom headers to login endpoint", async () => {
      await Auth.signIn("testuser", "testpass", undefined, {"X-Custom": "value"});

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(
        "/passport/login",
        {username: "testuser", password: "testpass", expires: undefined},
        {headers: {"X-Custom": "value"}}
      );
    });
  });

  describe("completePasswordlessLogin returning UserSession", () => {
    it("should return a UserSession instance", async () => {
      const session = await Auth.completePasswordlessLogin("testuser", "123456", "email");

      expect(session).toBeInstanceOf(UserSession);
    });

    it("should expose token from passwordless login response", async () => {
      const session = await Auth.completePasswordlessLogin("testuser", "123456", "email");

      expect(session.token).toBe("passwordless_token_xyz");
    });

    it("should expose userId and username from verify call", async () => {
      const session = await Auth.completePasswordlessLogin("testuser", "123456", "email");

      expect(session.userId).toBe("user_id_123");
      expect(session.username).toBe("testuser");
    });

    it("should call passwordless-login/verify then verify endpoint", async () => {
      await Auth.completePasswordlessLogin("testuser", "123456", "phone");

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(
        "passport/user/passwordless-login/verify",
        {username: "testuser", code: "123456", provider: "phone"},
        {headers: undefined}
      );

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith("passport/user/verify", {
        headers: {Authorization: "passwordless_token_xyz"}
      });
    });

    it("should pass custom headers to passwordless login endpoint", async () => {
      await Auth.completePasswordlessLogin("testuser", "123456", "email", {"X-Custom": "value"});

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(
        "passport/user/passwordless-login/verify",
        {username: "testuser", code: "123456", provider: "email"},
        {headers: {"X-Custom": "value"}}
      );
    });
  });

  describe("UserSession.get", () => {
    let session: UserSession;

    beforeEach(async () => {
      session = await Auth.signIn("testuser", "testpass");
      getSpy.mockClear();
    });

    it("should call GET passport/user/{userId} with stored token", async () => {
      await session.get();

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith("passport/user/user_id_123", {
        headers: {Authorization: "test_token_abc"}
      });
    });

    it("should merge custom headers", async () => {
      await session.get({"X-Custom": "header"});

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith("passport/user/user_id_123", {
        headers: {Authorization: "test_token_abc", "X-Custom": "header"}
      });
    });
  });

  describe("UserSession.updatePassword", () => {
    let session: UserSession;

    beforeEach(async () => {
      session = await Auth.signIn("testuser", "testpass");
      putSpy.mockClear();
    });

    it("should call PUT passport/user/{userId}/self with password", async () => {
      await session.updatePassword("newpassword");

      expect(putSpy).toHaveBeenCalledTimes(1);
      expect(putSpy).toHaveBeenCalledWith(
        "passport/user/user_id_123/self",
        {password: "newpassword"},
        {headers: {Authorization: "test_token_abc"}}
      );
    });

    it("should merge custom headers", async () => {
      await session.updatePassword("newpassword", {"X-Custom": "header"});

      expect(putSpy).toHaveBeenCalledTimes(1);
      expect(putSpy).toHaveBeenCalledWith(
        "passport/user/user_id_123/self",
        {password: "newpassword"},
        {headers: {Authorization: "test_token_abc", "X-Custom": "header"}}
      );
    });
  });

  describe("UserSession.refreshAccessToken", () => {
    let session: UserSession;

    beforeEach(async () => {
      session = await Auth.signIn("testuser", "testpass");
      postSpy.mockClear();
    });

    it("should call POST passport/user/session/refresh with stored token", async () => {
      const newToken = await session.refreshAccessToken();

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(
        "passport/user/session/refresh",
        {},
        {
          headers: {Authorization: "test_token_abc"},
          withCredentials: true
        }
      );

      expect(newToken).toBe("refreshed_token_456");
    });

    it("should update internal token after refresh", async () => {
      expect(session.token).toBe("test_token_abc");

      await session.refreshAccessToken();

      expect(session.token).toBe("refreshed_token_456");
    });

    it("should use refreshed token in subsequent calls", async () => {
      await session.refreshAccessToken();

      postSpy.mockClear();
      getSpy.mockClear();

      await session.get();

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith("passport/user/user_id_123", {
        headers: {Authorization: "refreshed_token_456"}
      });
    });

    it("should merge custom headers", async () => {
      await session.refreshAccessToken({Cookie: "refresh_token=abc"});

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(
        "passport/user/session/refresh",
        {},
        {
          headers: {Authorization: "test_token_abc", Cookie: "refresh_token=abc"},
          withCredentials: true
        }
      );
    });
  });

  describe("UserSession.addEmail", () => {
    let session: UserSession;

    beforeEach(async () => {
      session = await Auth.signIn("testuser", "testpass");
      postSpy.mockClear();
    });

    it("should call start-provider-verification with email and stored ID", async () => {
      await session.addEmail("test@test.com", "Otp");

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(
        "passport/user/user_id_123/start-provider-verification",
        {value: "test@test.com", provider: "email", strategy: "Otp", purpose: "verification"},
        {headers: {Authorization: "test_token_abc"}}
      );
    });

    it("should support MagicLink strategy", async () => {
      await session.addEmail("test@test.com", "MagicLink");

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(
        "passport/user/user_id_123/start-provider-verification",
        {value: "test@test.com", provider: "email", strategy: "MagicLink", purpose: "verification"},
        {headers: {Authorization: "test_token_abc"}}
      );
    });

    it("should merge custom headers", async () => {
      await session.addEmail("test@test.com", "Otp", {"X-Custom": "header"});

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(
        "passport/user/user_id_123/start-provider-verification",
        {value: "test@test.com", provider: "email", strategy: "Otp", purpose: "verification"},
        {headers: {Authorization: "test_token_abc", "X-Custom": "header"}}
      );
    });
  });

  describe("UserSession.verifyEmail", () => {
    let session: UserSession;

    beforeEach(async () => {
      session = await Auth.signIn("testuser", "testpass");
      postSpy.mockClear();
    });

    it("should call verify-provider with email code and stored ID", async () => {
      await session.verifyEmail("123456", "Otp");

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(
        "passport/user/user_id_123/verify-provider",
        {code: "123456", provider: "email", strategy: "Otp", purpose: "verification"},
        {headers: {Authorization: "test_token_abc"}}
      );
    });

    it("should merge custom headers", async () => {
      await session.verifyEmail("123456", "Otp", {"X-Custom": "header"});

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(
        "passport/user/user_id_123/verify-provider",
        {code: "123456", provider: "email", strategy: "Otp", purpose: "verification"},
        {headers: {Authorization: "test_token_abc", "X-Custom": "header"}}
      );
    });
  });

  describe("UserSession.addPhoneNumber", () => {
    let session: UserSession;

    beforeEach(async () => {
      session = await Auth.signIn("testuser", "testpass");
      postSpy.mockClear();
    });

    it("should call start-provider-verification with phone and stored ID", async () => {
      await session.addPhoneNumber("+1234567890", "Otp");

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(
        "passport/user/user_id_123/start-provider-verification",
        {value: "+1234567890", provider: "phone", strategy: "Otp", purpose: "verification"},
        {headers: {Authorization: "test_token_abc"}}
      );
    });

    it("should merge custom headers", async () => {
      await session.addPhoneNumber("+1234567890", "Otp", {"X-Custom": "header"});

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(
        "passport/user/user_id_123/start-provider-verification",
        {value: "+1234567890", provider: "phone", strategy: "Otp", purpose: "verification"},
        {headers: {Authorization: "test_token_abc", "X-Custom": "header"}}
      );
    });
  });

  describe("UserSession.verifyPhoneNumber", () => {
    let session: UserSession;

    beforeEach(async () => {
      session = await Auth.signIn("testuser", "testpass");
      postSpy.mockClear();
    });

    it("should call verify-provider with phone code and stored ID", async () => {
      await session.verifyPhoneNumber("123456", "Otp");

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(
        "passport/user/user_id_123/verify-provider",
        {code: "123456", provider: "phone", strategy: "Otp", purpose: "verification"},
        {headers: {Authorization: "test_token_abc"}}
      );
    });

    it("should merge custom headers", async () => {
      await session.verifyPhoneNumber("123456", "Otp", {"X-Custom": "header"});

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(
        "passport/user/user_id_123/verify-provider",
        {code: "123456", provider: "phone", strategy: "Otp", purpose: "verification"},
        {headers: {Authorization: "test_token_abc", "X-Custom": "header"}}
      );
    });
  });

  describe("UserSession.requestPasswordReset", () => {
    let session: UserSession;

    beforeEach(async () => {
      session = await Auth.signIn("testuser", "testpass");
      postSpy.mockClear();
    });

    it("should call forgot-password/start with stored username", async () => {
      await session.requestPasswordReset("email");

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(
        "passport/user/forgot-password/start",
        {username: "testuser", provider: "email"},
        {headers: {Authorization: "test_token_abc"}}
      );
    });

    it("should support phone provider", async () => {
      await session.requestPasswordReset("phone");

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(
        "passport/user/forgot-password/start",
        {username: "testuser", provider: "phone"},
        {headers: {Authorization: "test_token_abc"}}
      );
    });

    it("should merge custom headers", async () => {
      await session.requestPasswordReset("email", {"X-Custom": "header"});

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(
        "passport/user/forgot-password/start",
        {username: "testuser", provider: "email"},
        {headers: {Authorization: "test_token_abc", "X-Custom": "header"}}
      );
    });
  });

  describe("UserSession.completePasswordReset", () => {
    let session: UserSession;

    beforeEach(async () => {
      session = await Auth.signIn("testuser", "testpass");
      postSpy.mockClear();
    });

    it("should call forgot-password/verify with stored username", async () => {
      await session.completePasswordReset("123456", "newpass123", "email");

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(
        "passport/user/forgot-password/verify",
        {username: "testuser", code: "123456", newPassword: "newpass123", provider: "email"},
        {headers: {Authorization: "test_token_abc"}}
      );
    });

    it("should support phone provider", async () => {
      await session.completePasswordReset("654321", "securepass", "phone");

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(
        "passport/user/forgot-password/verify",
        {username: "testuser", code: "654321", newPassword: "securepass", provider: "phone"},
        {headers: {Authorization: "test_token_abc"}}
      );
    });

    it("should merge custom headers", async () => {
      await session.completePasswordReset("123456", "newpass123", "email", {"X-Custom": "header"});

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(
        "passport/user/forgot-password/verify",
        {username: "testuser", code: "123456", newPassword: "newpass123", provider: "email"},
        {headers: {Authorization: "test_token_abc", "X-Custom": "header"}}
      );
    });
  });

  describe("root-level functions still work independently", () => {
    it("should still allow root-level get with explicit id", async () => {
      getSpy.mockClear();

      await Auth.get("some_other_user_id");

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith("passport/user/some_other_user_id", {headers: undefined});
    });

    it("should still allow root-level addEmail with explicit id", async () => {
      postSpy.mockClear();

      await Auth.addEmail("admin_user_id", "admin@test.com", "Otp");

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(
        "passport/user/admin_user_id/start-provider-verification",
        {value: "admin@test.com", provider: "email", strategy: "Otp", purpose: "verification"},
        {headers: undefined}
      );
    });

    it("should still allow root-level requestPasswordReset with explicit username", async () => {
      postSpy.mockClear();

      await Auth.requestPasswordReset("someuser", "email");

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(
        "passport/user/forgot-password/start",
        {username: "someuser", provider: "email"},
        {headers: undefined}
      );
    });
  });
});
