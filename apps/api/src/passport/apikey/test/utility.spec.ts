import {providePolicyFinalizer} from "../src/utility";
describe("Utilities", () => {
  it("should pull policy from apikey policies", async () => {
    const ApikeyService: any = {
      updateMany: (filter: object, update: object) => {
        return Promise.resolve();
      }
    };

    const updateManySpy = jest.spyOn(ApikeyService, "updateMany");

    const factoryFunction = providePolicyFinalizer(ApikeyService);
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
