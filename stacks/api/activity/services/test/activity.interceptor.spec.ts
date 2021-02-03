import {getUserId, getAction, getIdentifier} from "@spica-server/activity/services";

jasmine.addCustomEqualityTester((actual, expected) => {
  if (actual.toString() == expected.toString()) {
    return true;
  }
});

describe("Interceptor Unit Test", () => {
  it("should get action from method", () => {
    expect(getAction("POST")).toEqual(1);
    expect(getAction("PUT")).toEqual(2);
    expect(getAction("DELETE")).toEqual(3);
    expect(getAction("PATCH")).toEqual(4);
    expect(getAction("OPTIONS")).toEqual(undefined);
  });

  it("should get identifier from user object", () => {
    expect(getIdentifier({_id: "601a6438fcc8731a14115db8"})).toEqual(
      "601a6438fcc8731a14115db8" as any
    );
    expect(getUserId(undefined)).toEqual(undefined);
  });
});
