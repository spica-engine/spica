import {
  registerPolicyAttacher,
  providePolicyFinalizer
} from "@spica-server/passport/identity/src/utility";

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

  it("should not attach IdentityFullAccess if user tries to update attributes", () => {
    request.user.attributes = {
      role: "customer"
    };

    request.body = {...request.user, attributes: {role: "admin"}};

    const policyAttachedRequest = registerPolicyAttacher("IdentityFullAccess")(request);
    expect(policyAttachedRequest).toEqual(request);
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
