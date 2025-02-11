import {provideActivityFactory} from "./activity";
describe("Passport Activity Factory", () => {
  it("should return identity url", () => {
    let url = provideActivityFactory({resource: ["passport", "identity", "id1"]});
    expect(url).toEqual("passport/identity/id1/edit");
  });

  it("should return policy url", () => {
    let url = provideActivityFactory({resource: ["passport", "policy", "id1"]});
    expect(url).toEqual("passport/policy/id1/edit");
  });

  it("should return apikey url", () => {
    let url = provideActivityFactory({resource: ["passport", "apikey", "id1"]});
    expect(url).toEqual("passport/apikey/id1/edit");
  });

  it("should return settings url", () => {
    let url = provideActivityFactory({resource: ["preference", "passport"]});
    expect(url).toEqual("passport/settings");
  });

  it("should return undefined", () => {
    let url = provideActivityFactory({resource: ["unknown_module", "id1"]});
    expect(url).toEqual(undefined);
  });
});
