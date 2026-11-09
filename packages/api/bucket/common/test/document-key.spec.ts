import {documentKey, documentKeyField, withDocumentKey} from "@spica-server/bucket-common";
import {bindIdTypes} from "@spica-server/data";
import {IdTypes} from "@spica-server/interface-data";

describe("document key", () => {
  const mongoLike = {keyField: () => "_id"} as unknown as IdTypes;
  const primaryKeyed = {
    keyField: (bucket: {primary?: string}) => bucket.primary
  } as unknown as IdTypes;
  const bucket = {primary: "sku"};

  afterEach(() => bindIdTypes(undefined as unknown as IdTypes));

  describe("when the engine keys documents by _id", () => {
    beforeEach(() => bindIdTypes(mongoLike));

    it("should name _id as the key field whatever the bucket's primary field is", () => {
      expect(documentKeyField(bucket)).toBe("_id");
    });

    it("should read the key from _id", () => {
      expect(documentKey(bucket, {_id: "1", sku: "a"})).toBe("1");
    });

    it("should set the key on _id", () => {
      expect(withDocumentKey(bucket, {title: "t"}, "1")).toEqual({_id: "1", title: "t"});
    });
  });

  describe("when the engine keys documents by the primary field", () => {
    beforeEach(() => bindIdTypes(primaryKeyed));

    it("should name the primary field as the key field", () => {
      expect(documentKeyField(bucket)).toBe("sku");
    });

    it("should read the key from the primary field", () => {
      expect(documentKey(bucket, {_id: "1", sku: "a"})).toBe("a");
    });

    it("should set the key on the primary field and leave _id alone", () => {
      expect(withDocumentKey(bucket, {title: "t"}, "a")).toEqual({sku: "a", title: "t"});
    });
  });
});
