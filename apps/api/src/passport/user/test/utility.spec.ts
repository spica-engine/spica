import {
  registerPolicyAttacher,
  providePolicyFinalizer
} from "@spica-server/passport/user/src/utility";

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
    const userService: any = {
      updateMany: (filter: object, update: object) => {
        return Promise.resolve();
      }
    };

    const updateManySpy = jest.spyOn(userService, "updateMany");

    const factoryFunction = providePolicyFinalizer(userService);
    await factoryFunction("my_policy");

    expect(updateManySpy).toHaveBeenCalledTimes(1);
    expect(updateManySpy).toHaveBeenCalledWith(
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
