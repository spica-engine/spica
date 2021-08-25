import {
  registerPolicyAttacher,
  providePolicyFinalizer
} from "@spica-server/passport/identity/src/utility";

describe("Utilities", () => {
  it("should attach IdentityFullAccess when condition is valid", () => {
    let request = {
      params: {
        id: "test_user"
      },
      user: {
        _id: "test_user",
        policies: []
      }
    };

    let policyAttachedRequest = registerPolicyAttacher("IdentityFullAccess")(request);
    expect(policyAttachedRequest).toEqual({
      ...request,
      user: {_id: "test_user", policies: ["IdentityFullAccess"]}
    });

    policyAttachedRequest = registerPolicyAttacher([
      "IdentityFullAccess",
      "PreferenceReadOnlyAccess"
    ])(request);
    expect(policyAttachedRequest).toEqual({
      ...request,
      user: {_id: "test_user", policies: ["IdentityFullAccess", "PreferenceReadOnlyAccess"]}
    });
  });

  it("should pull policy from identity policies", async () => {
    const IdentityService: any = {
      updateMany: (filter: object, update: object) => {
        return Promise.resolve();
      }
    };

    const updateManySpy = spyOn(IdentityService, "updateMany");

    const factoryFunction = providePolicyFinalizer(IdentityService);
    await factoryFunction("my_policy");

    expect(updateManySpy).toHaveBeenCalledTimes(1);
    expect(updateManySpy).toHaveBeenCalledOnceWith(
      {
        policies: {
          $in: ["my_policy"]
        }
      },
      {
        $pull: {
          policies: "my_policy"
        }
      }
    );
  });
});
