import {Test, TestingModule} from "@nestjs/testing";
import {BucketService} from "@spica-server/bucket/services";
import {SchemaModule} from "@spica-server/core/schema";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {PreferenceModule} from "@spica-server/preference";
import {BucketSchemaResolver} from "./bucket.schema.resolver";

describe("Bucket Schema Resolver", () => {
  let module: TestingModule;
  let schemaResolver: BucketSchemaResolver;
  let bs: BucketService;

  const bucket = {
    _id: new ObjectId(),
    title: "New Bucket",
    description: "Describe your new bucket",
    icon: "view_stream",
    primary: "title",
    readOnly: false,
    properties: {
      title: {
        type: "string",
        title: "title",
        description: "Title of the row",
        options: {position: "left", visible: true}
      },
      description: {
        type: "textarea",
        title: "description",
        description: "Description of the row",
        options: {position: "right"}
      },
      text: {
        type: "string",
        title: "translatable text",
        description: "Text of the row",
        options: {position: "left", visible: true, translate: true}
      }
    }
  };

  const preference = {
    language: {
      available: {
        tr_TR: "Turkish",
        en_US: "English"
      },
      default: "en_US"
    }
  };

  beforeAll(async () => {
    const mockBucketService = {
      findOne: jasmine.createSpy("findOne").and.returnValue(Promise.resolve({...bucket})),
      getPreferences: jasmine
        .createSpy("getPreferences")
        .and.returnValue(Promise.resolve(preference))
    };

    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.create(), PreferenceModule, SchemaModule.forChild()],
      providers: [
        {
          provide: BucketService,
          useValue: mockBucketService
        }
      ]
    }).compile();
    bs = module.get(BucketService);
    schemaResolver = new BucketSchemaResolver(bs);
  });

  afterAll(async () => await module.close());

  it("should return the compiled bucket schema", async () => {
    const jsonSchema = await schemaResolver.resolve(bucket._id.toHexString());
    console.log(jsonSchema);
    expect(jsonSchema).toEqual({
      $schema: "http://spica.internal/bucket/schema",
      $id: String(bucket._id),
      title: "New Bucket",
      description: "Describe your new bucket",
      readOnly: false,
      additionalProperties: false,
      properties: {
        _schedule: {type: "string", format: "date-time"},
        title: {
          type: "string",
          title: "title",
          description: "Title of the row"
        },
        description: {
          type: "string",
          title: "description",
          description: "Description of the row"
        },
        text: {
          additionalProperties: false,
          type: "object",
          required: ["en_US"],
          properties: {
            tr_TR: {
              type: "string",
              title: "translatable text",
              description: "Text of the row"
            },
            en_US: {
              type: "string",
              title: "translatable text",
              description: "Text of the row"
            }
          }
        }
      }
    } as any);
    // IMPORTANT: Do not remove "as any" otherwise the compiler will hang forever.
  });

  it("should not return anything if invalid objectid is passed", async () => {
    const jsonSchema = await schemaResolver.resolve("absolutely_not_an_objectid");
    expect(jsonSchema).not.toBeTruthy();
  });
});
