import * as Identity from "../";
import {Axios} from "@spica-devkit/internal_common";

describe("@spica-devkit/identity ids", () => {
  describe("idOf", () => {
    it("should read the key of a MongoDB record", () => {
      expect(Identity.idOf({_id: "m1", identifier: "a"})).toBe("m1");
    });

    it("should read the key of a PostgreSQL record", () => {
      expect(Identity.idOf({id: "p1", identifier: "a"})).toBe("p1");
    });

    it("should give nothing for a record without a key", () => {
      expect(Identity.idOf({identifier: "a"})).toBeUndefined();
      expect(Identity.idOf(undefined)).toBeUndefined();
    });
  });

  describe("insert", () => {
    let putSpy: jest.SpyInstance;

    beforeEach(() => {
      jest.spyOn(Axios.prototype, "get").mockReturnValue(Promise.resolve());
      putSpy = jest.spyOn(Axios.prototype, "put").mockReturnValue(Promise.resolve());
      process.env.__INTERNAL__SPICA__PUBLIC_URL__ = "http://test";
      Identity.initialize({apikey: "TEST_APIKEY"});
    });

    afterEach(() => jest.restoreAllMocks());

    it.each([
      ["MongoDB", {_id: "m_identity", identifier: "test"}, "m_identity"],
      ["PostgreSQL", {id: "p_identity", identifier: "test"}, "p_identity"]
    ])(
      "should attach the policies to the identity a %s instance created",
      async (_, created, id) => {
        jest.spyOn(Axios.prototype, "post").mockReturnValue(Promise.resolve(created));

        await Identity.insert({identifier: "test", password: "test", policies: ["policy_id"]});

        expect(putSpy).toHaveBeenCalledWith(
          `passport/identity/${id}/policy/policy_id`,
          {},
          {headers: undefined}
        );
      }
    );
  });
});
