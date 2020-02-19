import {TestingModule, Test} from "@nestjs/testing";
import {DatabaseTestingModule, DatabaseService, ObjectId} from "@spica-server/database/testing";
import {PreferenceModule, Preference} from "@spica-server/preference";
import {SchemaModule} from "@spica-server/core/schema";
import {BucketSchemaResolver} from "./bucket.schema.resolver";
import {BucketService} from "./services/bucket.service";

describe("bucket service", () => {
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
      findOne: jasmine.createSpy("findOne").and.returnValue(Promise.resolve(bucket)),
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

  afterAll(async () => {
    await module.close();
  });

  it("should resolve bucket", async () => {
    const response = await schemaResolver.resolve(bucket._id.toHexString());
    expect(response).toEqual({
      title: "New Bucket",
      description: "Describe your new bucket",
      icon: "view_stream",
      primary: "title",
      readOnly: false,
      $schema: "http://spica.internal/bucket/schema",
      _id: bucket._id,
      $id: bucket._id,
      additionalProperties: false,
      properties: {
        _id: {type: "string", options: {position: undefined}, format: "objectid"},
        _schedule: {type: "string", format: "date-time"},
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
          additionalProperties: false,
          type: "object",
          required: ["en_US"],
          properties: {
            tr_TR: {
              type: "string",
              title: "translatable text",
              description: "Text of the row",
              options: {position: "left", visible: true, translate: true}
            },
            en_US: {
              type: "string",
              title: "translatable text",
              description: "Text of the row",
              options: {position: "left", visible: true, translate: true}
            }
          }
        }
      }
    } as any);
  });
});
