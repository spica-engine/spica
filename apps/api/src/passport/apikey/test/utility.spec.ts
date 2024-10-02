import {providePolicyFinalizer} from "@spica-server/passport/apikey/src/utility";
describe("Utilities", () => {
  it("should pull policy from apikey policies", async () => {
    const ApikeyService: any = {
      updateMany: (filter: object, update: object) => {
        return Promise.resolve();
      }
    };

    const updateManySpy = spyOn(ApikeyService, "updateMany");

    const factoryFunction = providePolicyFinalizer(ApikeyService);
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
