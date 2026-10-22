import {
  registerPolicyAttacher,
  providePolicyFinalizer
} from "@spica-server/passport-user/src/utility";

describe("Utilities", () => {
  let request;

  beforeEach(() => {
    request = {
      params: {
        id: "test_user"
      },
      user: {
        _id: "test_user",
        policies: []
      },
      body: {},
      method: "PUT"
    };
  });

  it("should attach userFullAccess if user tries to update password", () => {
    request.user.password = "new_pass";

    let policyAttachedRequest = registerPolicyAttacher("userFullAccess")(request);
    expect(policyAttachedRequest).toEqual({
      ...request,
      user: {...request.user, policies: ["userFullAccess"]}
    });

    policyAttachedRequest = registerPolicyAttacher(["userFullAccess", "PreferenceReadOnlyAccess"])(
      request
    );
    expect(policyAttachedRequest).toEqual({
      ...request,
      user: {...request.user, policies: ["userFullAccess", "PreferenceReadOnlyAccess"]}
    });
  });

  it("should pull policy from user policies", async () => {
    const users: any = {
      removePolicyFromAll: (policyId: string) => {
        return Promise.resolve(0);
      }
    };

    const removePolicyFromAllSpy = jest.spyOn(users, "removePolicyFromAll");

    const factoryFunction = providePolicyFinalizer(users);
    await factoryFunction("my_policy");

    expect(removePolicyFromAllSpy).toHaveBeenCalledTimes(1);
    expect(removePolicyFromAllSpy).toHaveBeenCalledWith("my_policy");
  });
});
