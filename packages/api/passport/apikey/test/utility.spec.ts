import {providePolicyFinalizer} from "@spica-server/passport-apikey/src/utility";
describe("Utilities", () => {
  it("should pull policy from apikey policies", async () => {
    const apiKeys: any = {
      removePolicyFromAll: (policyId: string) => {
        return Promise.resolve(0);
      }
    };

    const removePolicyFromAllSpy = jest.spyOn(apiKeys, "removePolicyFromAll");

    const factoryFunction = providePolicyFinalizer(apiKeys);
    await factoryFunction("my_policy");

    expect(removePolicyFromAllSpy).toHaveBeenCalledTimes(1);
    expect(removePolicyFromAllSpy).toHaveBeenCalledWith("my_policy");
  });
});
