import * as Auth from "../";
import {Axios} from "@spica-devkit/internal_common";

describe("@spica-devkit/auth ids", () => {
  beforeEach(() => {
    process.env.__INTERNAL__SPICA__PUBLIC_URL__ = "http://test";
    Auth.initialize({apikey: "TEST_APIKEY"});
    jest.spyOn(Axios.prototype, "post").mockResolvedValue({token: "token"});
  });

  afterEach(() => jest.restoreAllMocks());

  it.each([
    ["MongoDB", {_id: "m_user", username: "test"}, "m_user"],
    ["PostgreSQL", {id: "p_user", username: "test"}, "p_user"]
  ])("should name the session after the user a %s instance verified", async (_, verified, id) => {
    jest.spyOn(Axios.prototype, "get").mockResolvedValue(verified);

    const session = await Auth.signIn("test", "test");

    expect(session.userId).toBe(id);
  });

  it("should export idOf", () => {
    expect(Auth.idOf({id: "p1"})).toBe("p1");
    expect(Auth.idOf({_id: "m1"})).toBe("m1");
  });
});
