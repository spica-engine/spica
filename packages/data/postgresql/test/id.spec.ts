import {InvalidIdError} from "@spica-server/data";
import {PostgresIdTypes, UuidV7Type} from "@spica-server/data-postgresql";

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

describe("PostgresIdTypes", () => {
  const idTypes = new PostgresIdTypes();

  it("uses the uuid type for collections, buckets and unscoped ids", async () => {
    expect(idTypes.forCollection("identity")).toBeInstanceOf(UuidV7Type);
    expect(await idTypes.forBucket("any")).toBeInstanceOf(UuidV7Type);
    expect(idTypes.unscoped()).toBeInstanceOf(UuidV7Type);
  });
});
