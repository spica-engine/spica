import {Controller, Get, HttpStatus, INestApplication, Param} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Request} from "@spica-server/core-testing";
import {DataModule, ID} from "@spica-server/data";
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
  forBucket: async bucketId => fakeIdType(bucketId)
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
});
