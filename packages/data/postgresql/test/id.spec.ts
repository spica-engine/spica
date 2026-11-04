import {InvalidIdError} from "@spica-server/data";
import {
  BigintKeyType,
  IntegerKeyType,
  PostgresIdTypes,
  TextKeyType,
  UuidV7Type
} from "@spica-server/data-postgresql";
import {Session} from "@spica-server/data-postgresql-orm";

describe("UuidV7Type", () => {
  const idType = new UuidV7Type();
  const uuid = "01890a5d-ac96-774b-bcce-b302099a8057";

  describe("generate", () => {
    it("generates a version 7 uuid", () => {
      expect(idType.generate()).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      );
    });

    it("generates unique ids that sort in generation order", () => {
      const generated = Array.from({length: 2000}, () => idType.generate());
      expect(new Set(generated).size).toBe(generated.length);
      expect([...generated].sort()).toEqual(generated);
    });

    it("generates ids the type itself accepts", () => {
      const id = idType.generate();
      expect(idType.isValid(id)).toBe(true);
      expect(idType.is(id)).toBe(true);
      expect(idType.parse(id)).toBe(id);
    });
  });

  describe("parse", () => {
    it("returns the canonical lowercase form", () => {
      expect(idType.parse(uuid.toUpperCase())).toBe(uuid);
    });

    it.each([[null], [undefined]])("throws InvalidIdError for %p", value => {
      expect(() => idType.parse(value)).toThrow(InvalidIdError);
    });

    it.each([
      ["not-an-id"],
      [""],
      ["5f1e8b9c2a4d3e0012345678"],
      [uuid + "0"],
      [`{${uuid}}`],
      [`urn:uuid:${uuid}`],
      [uuid.replace(/-/g, "")],
      [123],
      [true],
      [{}],
      [[uuid]]
    ])("throws InvalidIdError for %p", value => {
      expect(() => idType.parse(value)).toThrow(InvalidIdError);
    });
  });

  describe("isValid and is", () => {
    it("accepts canonical uuids of any case", () => {
      expect(idType.isValid(uuid)).toBe(true);
      expect(idType.isValid(uuid.toUpperCase())).toBe(true);
    });

    it("rejects anything that is not a canonical uuid string", () => {
      expect(idType.isValid("5f1e8b9c2a4d3e0012345678")).toBe(false);
      expect(idType.isValid(null)).toBe(false);
      expect(idType.isValid({toString: () => uuid})).toBe(false);
      expect(idType.is(1)).toBe(false);
    });
  });

  describe("equals", () => {
    it("compares case-insensitively", () => {
      expect(idType.equals(uuid, uuid.toUpperCase())).toBe(true);
    });

    it("is false for different or invalid ids", () => {
      expect(idType.equals(uuid, idType.generate())).toBe(false);
      expect(idType.equals(uuid, "nope")).toBe(false);
      expect(idType.equals(null, null)).toBe(false);
    });
  });

  describe("serialize", () => {
    it("round-trips through parse", () => {
      expect(idType.serialize(idType.parse(uuid.toUpperCase()))).toBe(uuid);
    });
  });
});

describe("key types", () => {
  describe("integer", () => {
    const idType = new IntegerKeyType();

    it("parses whole numbers inside the int4 range", () => {
      expect(idType.parse("42")).toBe(42);
      expect(idType.parse(-7)).toBe(-7);
      expect(() => idType.parse("2147483648")).toThrow(InvalidIdError);
      expect(() => idType.parse("1.5")).toThrow(InvalidIdError);
      expect(() => idType.parse(1.5)).toThrow(InvalidIdError);
      expect(() => idType.parse(null)).toThrow(InvalidIdError);
    });

    it("tells ids from other values", () => {
      expect(idType.is(5)).toBe(true);
      expect(idType.is("5")).toBe(false);
      expect(idType.isValid("5")).toBe(true);
      expect(idType.isValid("x")).toBe(false);
      expect(idType.equals("5", 5)).toBe(true);
      expect(idType.serialize(idType.parse("5"))).toBe("5");
    });

    it("cannot generate a key", () => {
      expect(() => idType.generate()).toThrow("cannot be generated");
    });
  });

  describe("bigint", () => {
    const idType = new BigintKeyType();

    it("keeps values above 2^53 exact as strings", () => {
      expect(idType.parse("9223372036854775807")).toBe("9223372036854775807");
      expect(idType.parse("007")).toBe("7");
      expect(() => idType.parse("9223372036854775808")).toThrow(InvalidIdError);
      expect(() => idType.parse("1e3")).toThrow(InvalidIdError);
    });

    it("compares by value", () => {
      expect(idType.equals("007", "7")).toBe(true);
      expect(idType.equals("7", "8")).toBe(false);
      expect(idType.is("7")).toBe(true);
      expect(idType.is(7)).toBe(false);
    });
  });

  describe("text", () => {
    const idType = new TextKeyType();

    it("accepts any string as it is", () => {
      expect(idType.parse("My Key/1")).toBe("My Key/1");
      expect(() => idType.parse(1)).toThrow(InvalidIdError);
      expect(idType.equals("a", "a")).toBe(true);
      expect(idType.equals("a", "A")).toBe(false);
    });
  });
});

describe("PostgresIdTypes", () => {
  const bucketId = "01890a5d-ac96-774b-bcce-b302099a8057";
  const bucketWith = (primary: string, type: string) => ({
    primary,
    properties: {[primary]: {type}}
  });
  const idTypesFor = (row: unknown) => {
    const findById = jest.fn(async () => row);
    return {findById, idTypes: new PostgresIdTypes({findById} as unknown as Session)};
  };

  it("uses the uuid type for collections and unscoped ids", () => {
    const {idTypes} = idTypesFor(null);
    expect(idTypes.forCollection("identity")).toBeInstanceOf(UuidV7Type);
    expect(idTypes.unscoped()).toBeInstanceOf(UuidV7Type);
  });

  it.each([
    ["uuid", UuidV7Type],
    ["integer", IntegerKeyType],
    ["bigint", BigintKeyType],
    ["string", TextKeyType]
  ])("uses the key type of a bucket whose primary is %s", async (type, expected) => {
    const {idTypes} = idTypesFor(bucketWith("key", type));
    expect(await idTypes.forBucket(bucketId)).toBeInstanceOf(expected);
  });

  it("falls back to uuid for an unknown bucket or one without a usable primary", async () => {
    expect(await idTypesFor(null).idTypes.forBucket(bucketId)).toBeInstanceOf(UuidV7Type);
    expect(
      await idTypesFor(bucketWith("key", "boolean")).idTypes.forBucket(bucketId)
    ).toBeInstanceOf(UuidV7Type);
  });

  it("does not query for an id that is not a uuid", async () => {
    const {idTypes, findById} = idTypesFor(bucketWith("key", "integer"));
    expect(await idTypes.forBucket("any")).toBeInstanceOf(UuidV7Type);
    expect(findById).not.toHaveBeenCalled();
  });
});
