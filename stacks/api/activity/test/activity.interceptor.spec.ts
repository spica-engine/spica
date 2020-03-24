import {getAction, getUser, ActivityInterceptor} from "../activity.interceptor";

describe("Interceptor Unit Test", () => {
  it("should get action from method", () => {
    expect(getAction("POST")).toEqual("INSERT");
    expect(getAction("PUT")).toEqual("UPDATE");
    expect(getAction("DELETE")).toEqual("DELETE");
    expect(getAction("PATCH")).toEqual(undefined);
  });

  it("should get identifier from user object", () => {
    expect(getUser({identifier: "spica"})).toEqual("spica");
    expect(getUser(undefined)).toEqual(undefined);
  });
});
