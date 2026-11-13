import {documentKey, documentKeyField, withDocumentKey} from "@spica-server/bucket-common";
import {bindIdTypes} from "@spica-server/data";
import {IdTypes} from "@spica-server/interface-data";

describe("document key", () => {
  const fixedKey = {keyField: () => "ref"} as unknown as IdTypes;
  const primaryKeyed = {
    keyField: (bucket: {primary?: string}) => bucket.primary
  } as unknown as IdTypes;
  const bucket = {primary: "sku"};

  afterEach(() => bindIdTypes(undefined as unknown as IdTypes));

  describe("when the engine keys documents by a fixed field", () => {
    beforeEach(() => bindIdTypes(fixedKey));

    it("should name the fixed field as the key field whatever the bucket's primary field is", () => {
      expect(documentKeyField(bucket)).toBe("ref");
    });

    it("should read the key from the fixed field", () => {
      expect(documentKey(bucket, {ref: "1", sku: "a"})).toBe("1");
    });

    it("should set the key on the fixed field", () => {
      expect(withDocumentKey(bucket, {title: "t"}, "1")).toEqual({ref: "1", title: "t"});
    });
  });

  describe("when the engine keys documents by the primary field", () => {
    beforeEach(() => bindIdTypes(primaryKeyed));

    it("should name the primary field as the key field", () => {
      expect(documentKeyField(bucket)).toBe("sku");
    });

    it("should read the key from the primary field", () => {
      expect(documentKey(bucket, {ref: "1", sku: "a"})).toBe("a");
    });

    it("should set the key on the primary field and leave the fixed field alone", () => {
      expect(withDocumentKey(bucket, {title: "t"}, "a")).toEqual({sku: "a", title: "t"});
    });
  });
});
