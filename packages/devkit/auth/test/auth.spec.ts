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

    it("should get all users", () => {
      Auth.getAll();

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith("passport/user", {
        params: {},
        headers: undefined
      });
    });

    it("should get all users with headers", () => {
      Auth.getAll({}, {Accept: "application/json"});

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith("passport/user", {
        params: {},
        headers: {Accept: "application/json"}
      });
    });

    it("should get all users with query params", () => {
      Auth.getAll({limit: 10, skip: 5, paginate: true});

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith("passport/user", {
        params: {limit: 10, skip: 5, paginate: true},
        headers: undefined
      });
    });

    it("should get all users with filter", () => {
      Auth.getAll({filter: {username: "test"}});

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith("passport/user", {
        params: {filter: {username: "test"}},
        headers: undefined
      });
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

  describe("remove", () => {
    it("should remove user", () => {
      Auth.remove("user_id");

      expect(deleteSpy).toHaveBeenCalledTimes(1);
      expect(deleteSpy).toHaveBeenCalledWith("passport/user/user_id", {
        headers: undefined
      });
    });

    it("should remove user with headers", () => {
      Auth.remove("user_id", {Accept: "application/json"});

      expect(deleteSpy).toHaveBeenCalledTimes(1);
      expect(deleteSpy).toHaveBeenCalledWith("passport/user/user_id", {
        headers: {Accept: "application/json"}
      });
    });
  });

  describe("policy", () => {
    it("should attach policy", async () => {
      await Auth.policy.attach("user_id", ["policy_id"]);

      expect(putSpy).toHaveBeenCalledTimes(1);
      expect(putSpy).toHaveBeenCalledWith(
        "passport/user/user_id/policy/policy_id",
        {},
        {headers: undefined}
      );
    });

    it("should attach policy with headers", async () => {
      await Auth.policy.attach("user_id", ["policy_id"], {Accept: "application/json"});

      expect(putSpy).toHaveBeenCalledTimes(1);
      expect(putSpy).toHaveBeenCalledWith(
        "passport/user/user_id/policy/policy_id",
        {},
        {headers: {Accept: "application/json"}}
      );
    });

    it("should attach multiple policies", async () => {
      await Auth.policy.attach("user_id", ["policy_1", "policy_2"]);

      expect(putSpy).toHaveBeenCalledTimes(2);
      expect(putSpy).toHaveBeenCalledWith(
        "passport/user/user_id/policy/policy_1",
        {},
        {headers: undefined}
      );
      expect(putSpy).toHaveBeenCalledWith(
        "passport/user/user_id/policy/policy_2",
        {},
        {headers: undefined}
      );
    });

    it("should return attached policy ids", async () => {
      const result = await Auth.policy.attach("user_id", ["policy_1", "policy_2"]);

      expect(result).toEqual(["policy_1", "policy_2"]);
    });

    it("should handle empty policy ids on attach", async () => {
      const result = await Auth.policy.attach("user_id", []);

      expect(putSpy).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it("should detach policy", async () => {
      await Auth.policy.detach("user_id", ["policy_id"]);

      expect(deleteSpy).toHaveBeenCalledTimes(1);
      expect(deleteSpy).toHaveBeenCalledWith("passport/user/user_id/policy/policy_id", {
        headers: undefined
      });
    });

    it("should detach policy with headers", async () => {
      await Auth.policy.detach("user_id", ["policy_id"], {Accept: "application/json"});

      expect(deleteSpy).toHaveBeenCalledTimes(1);
      expect(deleteSpy).toHaveBeenCalledWith("passport/user/user_id/policy/policy_id", {
        headers: {Accept: "application/json"}
      });
    });

    it("should detach multiple policies", async () => {
      await Auth.policy.detach("user_id", ["policy_1", "policy_2"]);

      expect(deleteSpy).toHaveBeenCalledTimes(2);
      expect(deleteSpy).toHaveBeenCalledWith("passport/user/user_id/policy/policy_1", {
        headers: undefined
      });
      expect(deleteSpy).toHaveBeenCalledWith("passport/user/user_id/policy/policy_2", {
        headers: undefined
      });
    });

    it("should return detached policy ids", async () => {
      const result = await Auth.policy.detach("user_id", ["policy_1", "policy_2"]);

      expect(result).toEqual(["policy_1", "policy_2"]);
    });

    it("should handle empty policy ids on detach", async () => {
      const result = await Auth.policy.detach("user_id", []);

      expect(deleteSpy).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it("should exclude failed policies from attach result", async () => {
      putSpy.mockImplementation((url: string) => {
        if (url.includes("policy_2")) {
          return Promise.reject(new Error("not found"));
        }
        return Promise.resolve();
      });

      const result = await Auth.policy.attach("user_id", ["policy_1", "policy_2"]);

      expect(result).toEqual(["policy_1"]);
    });

    it("should exclude failed policies from detach result", async () => {
      deleteSpy.mockImplementation((url: string) => {
        if (url.includes("policy_2")) {
          return Promise.reject(new Error("not found"));
        }
        return Promise.resolve();
      });

      const result = await Auth.policy.detach("user_id", ["policy_1", "policy_2"]);

      expect(result).toEqual(["policy_1"]);
    });
  });
});
