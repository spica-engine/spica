import * as Auth from "../";
import {Axios} from "@spica-devkit/internal_common";

describe("@spica-devkit/auth", () => {
  let getSpy: jest.Mocked<any>;
  let postSpy: jest.Mocked<any>;
  let putSpy: jest.Mocked<any>;
  let deleteSpy: jest.Mocked<any>;

  beforeEach(() => {
    getSpy = jest.spyOn(Axios.prototype, "get").mockImplementation((url: string) => {
      if (url && url.includes("/verify")) {
        return Promise.resolve({_id: "user_id", username: "test"});
      }
      return Promise.resolve();
    });
    postSpy = jest.spyOn(Axios.prototype, "post").mockImplementation((url: string) => {
      if (url && url.includes("/passwordless-login/verify")) {
        return Promise.resolve({
          token: "passwordless_token",
          scheme: "USER",
          issuer: "passport/user"
        });
      }
      return Promise.resolve({_id: "user_id", username: "test"});
    });
    putSpy = jest.spyOn(Axios.prototype, "put").mockReturnValue(Promise.resolve());
    deleteSpy = jest.spyOn(Axios.prototype, "delete").mockReturnValue(Promise.resolve());

    process.env.__INTERNAL__SPICA__PUBLIC_URL__ = "http://test";
    Auth.initialize({apikey: "TEST_APIKEY"});
  });

  afterEach(() => {
    getSpy.mockClear();
    postSpy.mockClear();
    putSpy.mockClear();
    deleteSpy.mockClear();
  });

  describe("errors", () => {
    it("should throw error when public url parameter and internal public url are missing", async () => {
      delete process.env.__INTERNAL__SPICA__PUBLIC_URL__;
      expect(() => Auth.initialize({apikey: "TEST_APIKEY"})).toThrowError(
        "Public url must be provided."
      );
    });
  });

  describe("Auth", () => {
    const user: Auth.UserCreate = {
      username: "test",
      password: "test"
    };

    it("should sign up user", () => {
      Auth.signUp(user);

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(
        "passport/user",
        {
          username: "test",
          password: "test"
        },
        {headers: undefined}
      );

      expect(user).toEqual({username: "test", password: "test"});
    });

    it("should sign up user with headers", () => {
      Auth.signUp(user, {Accept: "application/json"});

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(
        "passport/user",
        {
          username: "test",
          password: "test"
        },
        {headers: {Accept: "application/json"}}
      );

      expect(user).toEqual({username: "test", password: "test"});
    });

    it("should refresh token", async () => {
      Auth.refreshAccessToken("old_token", {Cookie: "refresh_token=refresh_token_value"});

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(
        "passport/user/session/refresh",
        {},
        {
          headers: {
            Authorization: "old_token",
            Cookie: "refresh_token=refresh_token_value"
          },
          withCredentials: true
        }
      );
    });

    it("should add email", () => {
      Auth.addEmail("user_id", "test@test.com", "Otp");

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(
        "passport/user/user_id/start-provider-verification",
        {value: "test@test.com", provider: "email", strategy: "Otp", purpose: "verification"},
        {headers: undefined}
      );
    });

    it("should add email with headers", () => {
      Auth.addEmail("user_id", "test@test.com", "Otp", {Accept: "application/json"});

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(
        "passport/user/user_id/start-provider-verification",
        {value: "test@test.com", provider: "email", strategy: "Otp", purpose: "verification"},
        {headers: {Accept: "application/json"}}
      );
    });

    it("should verify email", () => {
      Auth.verifyEmail("user_id", "123456", "Otp");

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(
        "passport/user/user_id/verify-provider",
        {code: "123456", provider: "email", strategy: "Otp", purpose: "verification"},
        {headers: undefined}
      );
    });

    it("should add phone number", () => {
      Auth.addPhoneNumber("user_id", "+1234567890", "Otp");

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(
        "passport/user/user_id/start-provider-verification",
        {value: "+1234567890", provider: "phone", strategy: "Otp", purpose: "verification"},
        {headers: undefined}
      );
    });

    it("should verify phone number", () => {
      Auth.verifyPhoneNumber("user_id", "123456", "Otp");

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(
        "passport/user/user_id/verify-provider",
        {code: "123456", provider: "phone", strategy: "Otp", purpose: "verification"},
        {headers: undefined}
      );
    });

    it("should request password reset", () => {
      Auth.requestPasswordReset("testuser", "email");

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(
        "passport/user/forgot-password/start",
        {username: "testuser", provider: "email"},
        {headers: undefined}
      );
    });

    it("should complete password reset", () => {
      Auth.completePasswordReset("testuser", "123456", "newpass", "email");

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(
        "passport/user/forgot-password/verify",
        {username: "testuser", code: "123456", newPassword: "newpass", provider: "email"},
        {headers: undefined}
      );
    });

    it("should start passwordless login", () => {
      Auth.passwordlessLogin("testuser", "email");

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(
        "passport/user/passwordless-login/start",
        {username: "testuser", provider: "email"},
        {headers: undefined}
      );
    });

    it("should complete passwordless login", async () => {
      await Auth.completePasswordlessLogin("testuser", "123456", "email");

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(
        "passport/user/passwordless-login/verify",
        {username: "testuser", code: "123456", provider: "email"},
        {headers: undefined}
      );

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith("passport/user/verify", {
        headers: {Authorization: "passwordless_token"}
      });
    });

    it("should complete passwordless login with headers", async () => {
      await Auth.completePasswordlessLogin("testuser", "123456", "phone", {
        Accept: "application/json"
      });

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(
        "passport/user/passwordless-login/verify",
        {username: "testuser", code: "123456", provider: "phone"},
        {headers: {Accept: "application/json"}}
      );
    });
  });
});
