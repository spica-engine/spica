import {getAction, getUser} from "@spica-server/activity/src";

describe("Interceptor Unit Test", () => {
  it("should get action from method", () => {
    expect(getAction("POST")).toEqual(1);
    expect(getAction("PUT")).toEqual(2);
    expect(getAction("DELETE")).toEqual(3);
    expect(getAction("PATCH")).toEqual(undefined);
  });

  it("should get identifier from user object", () => {
    expect(getUser({_id: "user_id"})).toEqual("user_id");
    expect(getUser(undefined)).toEqual(undefined);
  });
});
