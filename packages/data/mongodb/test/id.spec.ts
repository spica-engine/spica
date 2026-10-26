import {InvalidIdError} from "@spica-server/data";
import {MongoIdTypes, ObjectIdType} from "@spica-server/data-mongodb";
import {ObjectId} from "@spica-server/database";

describe("ObjectIdType", () => {
  const idType = new ObjectIdType();
  const hex = "5f1e8b9c2a4d3e0012345678";

  describe("parse", () => {
    it("should parse a 24 character hex string", () => {
      const id = idType.parse(hex);
      expect(id).toBeInstanceOf(ObjectId);
      expect(id.toHexString()).toBe(hex);
    });

    it("should parse an ObjectId into an equal ObjectId", () => {
      const original = new ObjectId();
      expect(idType.parse(original).equals(original)).toBe(true);
    });

    it("should parse a 12 byte buffer", () => {
      const original = new ObjectId(hex);
      expect(idType.parse(Buffer.from(original.id)).toHexString()).toBe(hex);
    });

    it("should parse a number the same way ObjectId does", () => {
      expect(idType.parse(1000).getTimestamp()).toEqual(new ObjectId(1000).getTimestamp());
    });

    it.each([["not-an-id"], ["123456789012"], [hex + "0"], [{}], [true]])(
      "should throw InvalidIdError with the driver's message for %p",
      value => {
        let driverError: Error;
        try {
          new ObjectId(value as any);
        } catch (e) {
          driverError = e;
        }

        let thrown: InvalidIdError;
        try {
          idType.parse(value);
        } catch (e) {
          thrown = e;
        }

        expect(thrown).toBeInstanceOf(InvalidIdError);
        expect(thrown.message).toBe(driverError.message);
        expect(thrown.cause).toBeInstanceOf(Error);
      }
    );

    it.each([[undefined], [null]])(
      "should throw InvalidIdError instead of generating for %p",
      value => {
        expect(() => idType.parse(value)).toThrow(InvalidIdError);
      }
    );
  });

  describe("isValid", () => {
    it.each([
      [hex],
      [new ObjectId()],
      [1000],
      ["not-an-id"],
      ["123456789012"],
      [hex.toUpperCase()],
      [undefined],
      [null],
      [{}]
    ])("should agree with ObjectId.isValid for %p", value => {
      expect(idType.isValid(value)).toBe(ObjectId.isValid(value as any));
    });
  });

  describe("generate", () => {
    it("should generate distinct ObjectIds", () => {
      const a = idType.generate();
      const b = idType.generate();
      expect(a).toBeInstanceOf(ObjectId);
      expect(a.equals(b)).toBe(false);
    });
  });

  describe("is", () => {
    it("should recognize ObjectId instances only", () => {
      expect(idType.is(new ObjectId())).toBe(true);
      expect(idType.is(hex)).toBe(false);
      expect(idType.is(undefined)).toBe(false);
    });
  });

  describe("equals", () => {
    it("should compare ObjectIds and hex strings by value", () => {
      expect(idType.equals(new ObjectId(hex), hex)).toBe(true);
      expect(idType.equals(hex, new ObjectId(hex))).toBe(true);
      expect(idType.equals(new ObjectId(hex), new ObjectId(hex))).toBe(true);
    });

    it("should return false for different ids", () => {
      expect(idType.equals(new ObjectId(), new ObjectId())).toBe(false);
    });

    it("should return false instead of throwing for invalid input", () => {
      expect(idType.equals(hex, "not-an-id")).toBe(false);
      expect(idType.equals(undefined, hex)).toBe(false);
      expect(idType.equals(null, null)).toBe(false);
    });
  });

  describe("serialize", () => {
    it("should serialize to the lowercase hex string", () => {
      expect(idType.serialize(new ObjectId(hex.toUpperCase()))).toBe(hex);
    });

    it("should round trip through parse", () => {
      const id = idType.generate();
      expect(idType.parse(idType.serialize(id)).equals(id)).toBe(true);
    });
  });
});

describe("MongoIdTypes", () => {
  const idTypes = new MongoIdTypes();

  it("should use ObjectId for every collection", () => {
    expect(idTypes.forCollection("identity")).toBeInstanceOf(ObjectIdType);
    expect(idTypes.forCollection("identity")).toBe(idTypes.forCollection("function"));
  });

  it("should use ObjectId for every bucket", async () => {
    const bucketIdType = await idTypes.forBucket("5f1e8b9c2a4d3e0012345678");
    expect(bucketIdType).toBe(idTypes.forCollection("buckets"));
  });

  it("should use ObjectId for ids whose resource is not known", () => {
    expect(idTypes.unscoped()).toBe(idTypes.forCollection("identity"));
  });
});
