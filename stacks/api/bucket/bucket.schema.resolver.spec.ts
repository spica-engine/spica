import {TestingModule, Test} from "@nestjs/testing";
import {DatabaseTestingModule, DatabaseService, ObjectId} from "@spica-server/database/testing";
import {PreferenceModule} from "@spica-server/preference";
import {SchemaModule} from "@spica-server/core/schema";
import {BucketModule} from "./bucket.module";
import {BucketSchemaResolver} from "./bucket.schema.resolver";

describe("bucket service", () => {
  let module: TestingModule;
  let schemaResolver: BucketSchemaResolver;
  const bucketId = new ObjectId();
  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        DatabaseTestingModule.replicaSet(),
        PreferenceModule,
        SchemaModule.forChild(),
        BucketModule
      ]
    }).compile();
    schemaResolver = module.get(BucketSchemaResolver);

    //add bucket
    await module
      .get(DatabaseService)
      .collection("buckets")
      .insertOne({
        _id: bucketId,
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
      });
  }, 30000);

  afterAll(async () => {
    await module.close();
  });

  it("should resolve bucket", async () => {
    const response = await schemaResolver.resolve(bucketId.toHexString());
    expect(response).toEqual({
      title: "New Bucket",
      description: "Describe your new bucket",
      icon: "view_stream",
      primary: "title",
      readOnly: false,
      $schema: "http://spica.internal/bucket/schema",
      _id: bucketId.toHexString(),
      $id: bucketId.toHexString(),
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
