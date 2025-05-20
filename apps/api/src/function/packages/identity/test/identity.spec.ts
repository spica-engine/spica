import * as Identity from "@spica-devkit/identity";
import {Axios} from "@spica-devkit/internal_common";

describe("@spica-devkit/identity", () => {
  let getSpy: jest.Mocked<any>;
  let postSpy: jest.Mocked<any>;
  let putSpy: jest.Mocked<any>;
  let deleteSpy: jest.Mocked<any>;

  beforeEach(() => {
    getSpy = jest.spyOn(Axios.prototype, "get").mockReturnValue(Promise.resolve());
    postSpy = jest
      .spyOn(Axios.prototype, "post")
      .mockReturnValue(Promise.resolve({_id: "identity_id", identifier: "test"}));
    putSpy = jest.spyOn(Axios.prototype, "put").mockReturnValue(Promise.resolve());
    deleteSpy = jest.spyOn(Axios.prototype, "delete").mockReturnValue(Promise.resolve());

    process.env.__INTERNAL__SPICA__PUBLIC_URL__ = "http://test";
    Identity.initialize({apikey: "TEST_APIKEY"});
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
      expect(() => Identity.initialize({apikey: "TEST_APIKEY"})).toThrowError(
        "Public url must be provided."
      );
    });
  });

  describe("Identity", () => {
    const identity: Identity.IdentityCreate = {
      identifier: "test",
      password: "test",
      policies: []
    };

    it("should insert identity", () => {
      Identity.insert(identity);

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(
        "passport/identity",
        {
          identifier: "test",
          password: "test"
        },
        {headers: undefined}
      );

      expect(identity).toEqual({identifier: "test", password: "test", policies: []});
    });

    it("should insert identity with headers", () => {
      Identity.insert(identity, {Accept: "application/json"});

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(
        "passport/identity",
        {
          identifier: "test",
          password: "test"
        },
        {headers: {Accept: "application/json"}}
      );

      expect(identity).toEqual({identifier: "test", password: "test", policies: []});
    });

    it("should insert identity with policies", async () => {
      const identityWithPolicy = {...identity, policies: ["policy_id"]};

      await Identity.insert(identityWithPolicy);

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(
        "passport/identity",
        {
          identifier: "test",
          password: "test"
        },
        {headers: undefined}
      );

      expect(putSpy).toHaveBeenCalledTimes(1);
      expect(putSpy).toHaveBeenCalledWith(
        "passport/identity/identity_id/policy/policy_id",
        {},
        {headers: undefined}
      );

      expect(identity).toEqual({identifier: "test", password: "test", policies: []});
    });

    it("should get all identities", () => {
      Identity.getAll();

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith("passport/identity", {
        params: {},
        headers: undefined
      });
    });

    it("should get all identities with headers", () => {
      Identity.getAll({}, {Accept: "application/json"});

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith("passport/identity", {
        params: {},
        headers: {Accept: "application/json"}
      });
    });

    it("should get specific identity", () => {
      Identity.get("identity_id");

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith("passport/identity/identity_id", {headers: undefined});
    });

    it("should get specific identity with headers", () => {
      Identity.get("identity_id", {Accept: "application/json"});

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith("passport/identity/identity_id", {
        headers: {Accept: "application/json"}
      });
    });

    it("should remove identity", () => {
      Identity.remove("identity_id");

      expect(deleteSpy).toHaveBeenCalledTimes(1);
      expect(deleteSpy).toHaveBeenCalledWith("passport/identity/identity_id", {headers: undefined});
    });

    it("should remove multiple identities", () => {
      postSpy.mockReturnValue(Promise.resolve({responses: []}));
      Identity.removeMany(["identity_id_1", "identity_id_2"]);

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(
        "batch",
        {
          requests: [
            {
              body: undefined,
              headers: {
                Authorization: "APIKEY TEST_APIKEY"
              },
              id: "0",
              method: "DELETE",
              url: "passport/identity/identity_id_1"
            },
            {
              body: undefined,
              headers: {
                Authorization: "APIKEY TEST_APIKEY"
              },
              id: "1",
              method: "DELETE",
              url: "passport/identity/identity_id_2"
            }
          ]
        },
        {headers: undefined}
      );
    });

    it("should remove identity with headers", () => {
      Identity.remove("identity_id", {Accept: "application/json"});

      expect(deleteSpy).toHaveBeenCalledTimes(1);
      expect(deleteSpy).toHaveBeenCalledWith("passport/identity/identity_id", {
        headers: {Accept: "application/json"}
      });
    });

    it("should attach policy", () => {
      Identity.policy.attach("identity_id", ["policy_id"]);

      expect(putSpy).toHaveBeenCalledTimes(1);
      expect(putSpy).toHaveBeenCalledWith(
        "passport/identity/identity_id/policy/policy_id",
        {},
        {
          headers: undefined
        }
      );
    });

    it("should attach policy with headers", () => {
      Identity.policy.attach("identity_id", ["policy_id"], {Accept: "application/json"});

      expect(putSpy).toHaveBeenCalledTimes(1);
      expect(putSpy).toHaveBeenCalledWith(
        "passport/identity/identity_id/policy/policy_id",
        {},
        {
          headers: {Accept: "application/json"}
        }
      );
    });

    it("should detach policy", () => {
      Identity.policy.detach("identity_id", ["policy_id"]);

      expect(deleteSpy).toHaveBeenCalledTimes(1);
      expect(deleteSpy).toHaveBeenCalledWith("passport/identity/identity_id/policy/policy_id", {
        headers: undefined
      });
    });

    it("should detach policy with headers", () => {
      Identity.policy.detach("identity_id", ["policy_id"], {Accept: "application/json"});

      expect(deleteSpy).toHaveBeenCalledTimes(1);
      expect(deleteSpy).toHaveBeenCalledWith("passport/identity/identity_id/policy/policy_id", {
        headers: {Accept: "application/json"}
      });
    });
  });
});
