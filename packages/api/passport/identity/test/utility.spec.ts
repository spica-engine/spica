import {
  registerPolicyAttacher,
  providePolicyFinalizer
} from "@spica-server/passport-identity/src/utility";

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

  it("should attach IdentityFullAccess if user tries to update password", () => {
    request.user.password = "new_pass";

    let policyAttachedRequest = registerPolicyAttacher("IdentityFullAccess")(request);
    expect(policyAttachedRequest).toEqual({
      ...request,
      user: {...request.user, policies: ["IdentityFullAccess"]}
    });

    policyAttachedRequest = registerPolicyAttacher([
      "IdentityFullAccess",
      "PreferenceReadOnlyAccess"
    ])(request);
    expect(policyAttachedRequest).toEqual({
      ...request,
      user: {...request.user, policies: ["IdentityFullAccess", "PreferenceReadOnlyAccess"]}
    });
  });

  it("should pull policy from identity policies", async () => {
    const identities: any = {
      removePolicyFromAll: (policyId: string) => {
        return Promise.resolve(0);
      }
    };

    const removePolicyFromAllSpy = jest.spyOn(identities, "removePolicyFromAll");

    const factoryFunction = providePolicyFinalizer(identities);
    await factoryFunction("my_policy");

    expect(removePolicyFromAllSpy).toHaveBeenCalledTimes(1);
    expect(removePolicyFromAllSpy).toHaveBeenCalledWith("my_policy");
  });
});
