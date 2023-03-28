import {provideActivityFactory} from "./activity";
describe("Bucket Activity Factory", () => {
  it("should return bucket url", () => {
    let url = provideActivityFactory({resource: ["bucket", "id1"]});
    expect(url).toEqual("bucket/id1");
  });

  it("should return bucket-data url", () => {
    let url = provideActivityFactory({resource: ["bucket", "123", "data", "id1"]});
    expect(url).toEqual("bucket/123/id1");
  });

  it("should return bucket settings url", () => {
    let url = provideActivityFactory({resource: ["preference", "bucket"]});
    expect(url).toEqual("bucket/settings");
  });

  it("should return undefined", () => {
    let url = provideActivityFactory({resource: ["unkown_module", "id1"]});
    expect(url).toEqual(undefined);
  });
});
