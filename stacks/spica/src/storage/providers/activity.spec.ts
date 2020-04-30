import {provideActivityFactory} from "./activity";
describe("Storage Activity Factory", () => {
  it("should return storage url", () => {
    let url = provideActivityFactory({resource: {name: "Storage", documentId: "id1"}});
    expect(url).toEqual("storage/id1");
  });

  it("should return undefined", () => {
    let url = provideActivityFactory({resource: {name: "unknown_module", documentId: "id1"}});
    expect(url).toEqual(undefined);
  });
});
