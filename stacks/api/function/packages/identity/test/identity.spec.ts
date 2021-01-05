import * as Identity from "@spica-devkit/identity";
import {http} from "@spica-devkit/internal_common";

jasmine.getEnv().allowRespy(true);

describe("@spica-devkit/identity", () => {
  let getSpy: jasmine.SpyObj<any>;
  let postSpy: jasmine.SpyObj<any>;
  let putSpy: jasmine.SpyObj<any>;
  let deleteSpy: jasmine.SpyObj<any>;

  beforeEach(() => {
    process.env.__INTERNAL__SPICA__PUBLIC_URL__ = "http://test";
    Identity.initialize({apikey: "TEST_APIKEY"});

    getSpy = spyOn(http, "get").and.returnValue(Promise.resolve());
    postSpy = spyOn(http, "post").and.returnValue(
      Promise.resolve({_id: "identity_id", identifier: "test"})
    );
    putSpy = spyOn(http, "put").and.returnValue(Promise.resolve());
    deleteSpy = spyOn(http, "del").and.returnValue(Promise.resolve());
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
    const identity: Identity.Identity = {
      identifier: "test",
      password: "test"
    };

    it("should insert identity", () => {
      Identity.insert(identity);

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith("http://test/passport/identity", {
        headers: {Authorization: "APIKEY TEST_APIKEY", "Content-Type": "application/json"},
        body: JSON.stringify(identity)
      });
    });

    it("should insert identity with policies", async () => {
      const identityWithPolicy = {...identity, policies: ["policy_id"]};
      await Identity.insert(identityWithPolicy);

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith("http://test/passport/identity", {
        headers: {Authorization: "APIKEY TEST_APIKEY", "Content-Type": "application/json"},
        body: JSON.stringify(identityWithPolicy)
      });

      expect(putSpy).toHaveBeenCalledTimes(1);
      expect(putSpy).toHaveBeenCalledWith(
        "http://test/passport/identity/identity_id/policy/policy_id",
        {
          headers: {
            Authorization: "APIKEY TEST_APIKEY"
          }
        }
      );
    });

    it("should update identity", () => {
      const updatedIdentity = {...identity, identifier: "new_identifier"};
      Identity.update("identity_id", updatedIdentity);

      expect(putSpy).toHaveBeenCalledTimes(1);
      expect(putSpy).toHaveBeenCalledWith("http://test/passport/identity/identity_id", {
        headers: {Authorization: "APIKEY TEST_APIKEY", "Content-Type": "application/json"},
        body: JSON.stringify(updatedIdentity)
      });
    });

    it("should get all identities", () => {
      Identity.getAll();

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith(new URL("http://test/passport/identity"), {
        headers: {Authorization: "APIKEY TEST_APIKEY"}
      });
    });

    it("should get specific identity", () => {
      Identity.get("identity_id");

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith("http://test/passport/identity/identity_id", {
        headers: {Authorization: "APIKEY TEST_APIKEY"}
      });
    });

    it("should remove identity", () => {
      Identity.remove("identity_id");

      expect(deleteSpy).toHaveBeenCalledTimes(1);
      expect(deleteSpy).toHaveBeenCalledWith("http://test/passport/identity/identity_id", {
        headers: {Authorization: "APIKEY TEST_APIKEY"}
      });
    });

    it("should detach policy", () => {
      Identity.policy.detach("identity_id", ["policy_id"]);

      expect(deleteSpy).toHaveBeenCalledTimes(1);
      expect(deleteSpy).toHaveBeenCalledWith(
        "http://test/passport/identity/identity_id/policy/policy_id",
        {
          headers: {Authorization: "APIKEY TEST_APIKEY"}
        }
      );
    });
  });
});
