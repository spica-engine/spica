import * as Identity from "@spica-devkit/identity";
import {Axios} from "@spica-devkit/internal_common";

jasmine.getEnv().allowRespy(true);

describe("@spica-devkit/identity", () => {
  let getSpy: jasmine.SpyObj<any>;
  let postSpy: jasmine.SpyObj<any>;
  let putSpy: jasmine.SpyObj<any>;
  let deleteSpy: jasmine.SpyObj<any>;

  beforeEach(() => {
    getSpy = spyOn(Axios.prototype, "get").and.returnValue(Promise.resolve());
    postSpy = spyOn(Axios.prototype, "post").and.returnValue(
      Promise.resolve({_id: "identity_id", identifier: "test"})
    );
    putSpy = spyOn(Axios.prototype, "put").and.returnValue(Promise.resolve());
    deleteSpy = spyOn(Axios.prototype, "delete").and.returnValue(Promise.resolve());

    process.env.__INTERNAL__SPICA__PUBLIC_URL__ = "http://test";
    Identity.initialize({apikey: "TEST_APIKEY"});
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
      expect(postSpy).toHaveBeenCalledWith("passport/identity", {
        identifier: "test",
        password: "test"
      });

      expect(identity).toEqual(
        {identifier: "test", password: "test", policies: []},
        "should fail if original identity modified"
      );
    });

    it("should insert identity with policies", async () => {
      const identityWithPolicy = {...identity, policies: ["policy_id"]};

      await Identity.insert(identityWithPolicy);

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith("passport/identity", {
        identifier: "test",
        password: "test"
      });

      expect(putSpy).toHaveBeenCalledTimes(1);
      expect(putSpy).toHaveBeenCalledWith("passport/identity/identity_id/policy/policy_id", {});

      expect(identity).toEqual(
        {identifier: "test", password: "test", policies: []},
        "should fail if original identity modified"
      );
    });

    it("should get all identities", () => {
      Identity.getAll();

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith("passport/identity", {
        params: {}
      });
    });

    it("should get specific identity", () => {
      Identity.get("identity_id");

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith("passport/identity/identity_id");
    });

    it("should remove identity", () => {
      Identity.remove("identity_id");

      expect(deleteSpy).toHaveBeenCalledTimes(1);
      expect(deleteSpy).toHaveBeenCalledWith("passport/identity/identity_id");
    });

    it("should detach policy", () => {
      Identity.policy.detach("identity_id", ["policy_id"]);

      expect(deleteSpy).toHaveBeenCalledTimes(1);
      expect(deleteSpy).toHaveBeenCalledWith("passport/identity/identity_id/policy/policy_id");
    });
  });
});
