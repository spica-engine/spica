import {Controller, Get, HttpStatus, INestApplication, Param} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Request} from "@spica-server/core-testing";
import {bindIdTypes, DataModule, DocumentId, ID, idTransform} from "@spica-server/data";
import {Id, ID_TYPES, IdType, IdTypes} from "@spica-server/interface-data";

const VALID = "valid-id";

const parsedIds = new Map<string, string[]>();

function fakeIdType(collection: string): IdType {
  return {
    name: "fake",
    parse: value => {
      if (value !== VALID) {
        throw new Error("bad id");
      }
      parsedIds.set(collection, [...(parsedIds.get(collection) || []), value]);
      return {toString: () => `${collection}:${value}`, toJSON: () => `${collection}:${value}`};
    },
    isValid: value => value === VALID,
    generate: () => ({toString: () => "generated", toJSON: () => "generated"}),
    is: (value): value is Id => false,
    equals: (a, b) => a === b,
    serialize: id => id.toString()
  };
}

const fakeIdTypes: IdTypes = {
  forCollection: collection => fakeIdType(collection),
  forBucket: async bucketId => {
    if (bucketId === "missing") {
      throw new Error("no bucket");
    }
    return fakeIdType(bucketId);
  },
  unscoped: () => fakeIdType("unscoped")
};

@Controller()
class TestController {
  @Get("identity/:id")
  identity(@Param("id", ID("identity")) id: Id) {
    return {id: id.toString()};
  }

  @Get("apikey/:id")
  apikey(@Param("id", ID("apikey")) id: Id) {
    return {id: id.toString()};
  }

  @Get("bucket/:bucketId/data/:documentId")
  document(@DocumentId("documentId", "bucketId") documentId: Id) {
    return {id: documentId.toString()};
  }
}

describe("ID pipe", () => {
  let app: INestApplication;
  let req: Request;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        CoreTestingModule,
        DataModule.forRoot({
          engine: "fake",
          module: {
            module: class FakeAdapterModule {},
            providers: [{provide: ID_TYPES, useValue: fakeIdTypes}],
            exports: [ID_TYPES]
          }
        })
      ],
      controllers: [TestController]
    }).compile();
    app = module.createNestApplication();
    req = module.get(Request);
    await app.listen(req.socket);
  });

  afterAll(() => app.close());

  beforeEach(() => parsedIds.clear());

  it("should parse the id with the addressed collection's id type", async () => {
    const res = await req.get(`/identity/${VALID}`);
    expect(res.statusCode).toBe(HttpStatus.OK);
    expect(res.body).toEqual({id: `identity:${VALID}`});
    expect(parsedIds.get("identity")).toEqual([VALID]);
  });

  it("should keep collections apart", async () => {
    const res = await req.get(`/apikey/${VALID}`);
    expect(res.body).toEqual({id: `apikey:${VALID}`});
    expect(parsedIds.get("identity")).toBeUndefined();
  });

  it("should reject an invalid id the same way OBJECT_ID did", async () => {
    const res = await req.get("/identity/nope");
    expect(res.statusCode).toBe(HttpStatus.BAD_REQUEST);
    expect(res.body).toEqual({statusCode: 400, message: "Invalid id."});
  });

  describe("DocumentId", () => {
    it("should parse the document id with its bucket's id type", async () => {
      const res = await req.get(`/bucket/books/data/${VALID}`);
      expect(res.statusCode).toBe(HttpStatus.OK);
      expect(res.body).toEqual({id: `books:${VALID}`});
      expect(parsedIds.get("books")).toEqual([VALID]);
    });

    it("should resolve the id type from the bucket in the route", async () => {
      await req.get(`/bucket/books/data/${VALID}`);
      await req.get(`/bucket/authors/data/${VALID}`);
      expect(parsedIds.get("books")).toEqual([VALID]);
      expect(parsedIds.get("authors")).toEqual([VALID]);
    });

    it("should reject an invalid document id the same way OBJECT_ID did", async () => {
      const res = await req.get("/bucket/books/data/nope");
      expect(res.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(res.body).toEqual({statusCode: 400, message: "Invalid id."});
    });
  });

  describe("DocumentId with an unresolvable bucket", () => {
    it("should answer 400 when the engine cannot resolve the bucket's id type", async () => {
      const res = await req.get(`/bucket/missing/data/${VALID}`);
      expect(res.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(res.body).toEqual({statusCode: 400, message: "Invalid id."});
    });
  });

  describe("idTransform", () => {
    beforeEach(() => bindIdTypes(fakeIdTypes));

    it("should parse with the collection's id type", () => {
      expect(idTransform("storage").transform(VALID, undefined).toString()).toEqual(
        `storage:${VALID}`
      );
    });

    it("should throw the same 400 as OBJECT_ID for an invalid or missing id", () => {
      for (const value of ["nope", undefined, ""]) {
        expect(() => idTransform("storage").transform(value, undefined)).toThrow("Invalid id.");
      }
    });
  });
});
