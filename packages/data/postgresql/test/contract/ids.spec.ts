import {HttpException, HttpStatus} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {BucketDocumentIdPipe, ID, ids, idTransform, InvalidIdError} from "@spica-server/data";
import {contractSuite} from "@spica-server/database-testing";
import {ID_TYPES, IdTypes} from "@spica-server/interface-data";

contractSuite("id types", engine => {
  let module: TestingModule;
  let idTypes: IdTypes;

  beforeAll(async () => {
    module = await Test.createTestingModule({imports: [engine.module()]}).compile();
    await module.init();
    idTypes = module.get<IdTypes>(ID_TYPES);
  });

  afterAll(() => module.close());

  it("binds the engine's id types for code that has no injector", () => {
    expect(ids().forCollection("identity").name).toBe(idTypes.forCollection("identity").name);
  });

  it("generates ids the type accepts and round-trips them through their string form", () => {
    const idType = idTypes.forCollection("identity");
    const id = idType.generate();

    expect(idType.is(id)).toBe(true);
    expect(idType.isValid(idType.serialize(id))).toBe(true);
    expect(idType.equals(idType.parse(idType.serialize(id)), id)).toBe(true);
    expect(idType.equals(id, idType.generate())).toBe(false);
  });

  it("rejects values that are not ids", () => {
    const idType = idTypes.forCollection("identity");
    expect(idType.isValid("not-an-id")).toBe(false);
    expect(() => idType.parse("not-an-id")).toThrow(InvalidIdError);
  });

  describe("ID pipe", () => {
    it("parses a valid id and answers 400 for an invalid one", () => {
      const pipe = new (ID("identity"))(idTypes);
      const idType = idTypes.forCollection("identity");
      const id = idType.generate();

      expect(idType.equals(pipe.transform(idType.serialize(id)), id)).toBe(true);
      expect(() => pipe.transform("not-an-id")).toThrow(HttpException);
      try {
        pipe.transform("not-an-id");
      } catch (error) {
        expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      }
    });

    it("answers 400 for a missing id", () => {
      expect(() => new (ID("identity"))(idTypes).transform(undefined)).toThrow(HttpException);
    });
  });

  it("transforms ids without an injector", () => {
    const idType = idTypes.forCollection("storage");
    const id = idType.generate();
    expect(idType.equals(idTransform("storage").transform(idType.serialize(id), null), id)).toBe(
      true
    );
    expect(() => idTransform("storage").transform("nope", null)).toThrow(HttpException);
  });

  it("parses bucket document ids", async () => {
    const pipe = new BucketDocumentIdPipe(idTypes);
    const idType = await idTypes.forBucket("any");
    const id = idType.generate();

    const parsed = await pipe.transform({documentId: idType.serialize(id), bucketId: "any"});
    expect(idType.equals(parsed, id)).toBe(true);
    await expect(pipe.transform({documentId: "nope", bucketId: "any"})).rejects.toBeInstanceOf(
      HttpException
    );
  });
});
