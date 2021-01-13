import {
  attachIdentityAccess,
  providePolicyFinalizer
} from "@spica-server/passport/identity/src/utility";

describe("Utilities", () => {
  it("should attach IdentityFullAccess when condition is valid", () => {
    let request = {
      method: "PUT",
      params: {
        id: "test_user"
      },
      user: {
        _id: "test_user",
        policies: []
      }
    };
    expect(attachIdentityAccess(request)).toEqual({
      ...request,
      user: {_id: "test_user", policies: ["IdentityFullAccess"]}
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
