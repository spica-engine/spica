import {provideActivityFactory} from "./activity";
describe("Bucket Activity Factory", () => {
  it("should return bucket url", () => {
    let url = provideActivityFactory({resource: {name: "Bucket", documentId: "id1"}});
    expect(url).toEqual("buckets/id1");
  });

  it("should return bucket-data url", () => {
    let url = provideActivityFactory({resource: {name: "Bucket_123", documentId: "id1"}});
    expect(url).toEqual("bucket/123/id1");
  });

  it("should return bucket settings url", () => {
    let url = provideActivityFactory({resource: {name: "Preference", documentId: "bucket"}});
    expect(url).toEqual("buckets/settings");
  });

  it("should return undefined", () => {
    let url = provideActivityFactory({resource: {name: "unknown_module", documentId: "id1"}});
    expect(url).toEqual(undefined);
  });
});
