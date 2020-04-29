import {provideActivityFactory} from "./activity";
describe("Passport Activity Factory", () => {
  it("should return identity url", () => {
    let url = provideActivityFactory({resource: {name: "Identity", documentId: "id1"}});
    expect(url).toEqual("passport/identity/id1/edit");
  });

  it("should return policy url", () => {
    let url = provideActivityFactory({resource: {name: "Policy", documentId: "id1"}});
    expect(url).toEqual("passport/policy/id1/edit");
  });

  it("should return apikey url", () => {
    let url = provideActivityFactory({resource: {name: "Apikey", documentId: "id1"}});
    expect(url).toEqual("passport/apikey/id1/edit");
  });

  it("should return settings url", () => {
    let url = provideActivityFactory({resource: {name: "Preference", documentId: "passport"}});
    expect(url).toEqual("passport/settings");
  });

  it("should return undefined", () => {
    let url = provideActivityFactory({resource: {name: "unknown_module", documentId: "id1"}});
    expect(url).toEqual(undefined);
  });
});
