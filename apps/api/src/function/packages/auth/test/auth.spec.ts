import * as Auth from "@spica-devkit/auth";
import {Axios} from "@spica-devkit/internal_common";

describe("@spica-devkit/auth", () => {
  let getSpy: jest.Mocked<any>;
  let postSpy: jest.Mocked<any>;
  let putSpy: jest.Mocked<any>;
  let deleteSpy: jest.Mocked<any>;

  beforeEach(() => {
    getSpy = jest.spyOn(Axios.prototype, "get").mockReturnValue(Promise.resolve());
    postSpy = jest
      .spyOn(Axios.prototype, "post")
      .mockReturnValue(Promise.resolve({_id: "user_id", username: "test"}));
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
      password: "test",
      policies: []
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

      expect(user).toEqual({username: "test", password: "test", policies: []});
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

      expect(user).toEqual({username: "test", password: "test", policies: []});
    });

    it("should sign up user with policies", async () => {
      const userWithPolicy = {...user, policies: ["policy_id"]};

      await Auth.signUp(userWithPolicy);

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(
        "passport/user",
        {
          username: "test",
          password: "test"
        },
        {headers: undefined}
      );

      expect(putSpy).toHaveBeenCalledTimes(1);
      expect(putSpy).toHaveBeenCalledWith(
        "passport/user/user_id/policy/policy_id",
        {},
        {headers: undefined}
      );

      expect(user).toEqual({username: "test", password: "test", policies: []});
    });

    it("should attach policy", () => {
      Auth.policy.attach("user_id", ["policy_id"]);

      expect(putSpy).toHaveBeenCalledTimes(1);
      expect(putSpy).toHaveBeenCalledWith(
        "passport/user/user_id/policy/policy_id",
        {},
        {
          headers: undefined
        }
      );
    });

    it("should attach policy with headers", () => {
      Auth.policy.attach("user_id", ["policy_id"], {Accept: "application/json"});

      expect(putSpy).toHaveBeenCalledTimes(1);
      expect(putSpy).toHaveBeenCalledWith(
        "passport/user/user_id/policy/policy_id",
        {},
        {
          headers: {Accept: "application/json"}
        }
      );
    });

    it("should detach policy", () => {
      Auth.policy.detach("user_id", ["policy_id"]);

      expect(deleteSpy).toHaveBeenCalledTimes(1);
      expect(deleteSpy).toHaveBeenCalledWith("passport/user/user_id/policy/policy_id", {
        headers: undefined
      });
    });

    it("should detach policy with headers", () => {
      Auth.policy.detach("user_id", ["policy_id"], {Accept: "application/json"});

      expect(deleteSpy).toHaveBeenCalledTimes(1);
      expect(deleteSpy).toHaveBeenCalledWith("passport/user/user_id/policy/policy_id", {
        headers: {Accept: "application/json"}
      });
    });
  });
});
