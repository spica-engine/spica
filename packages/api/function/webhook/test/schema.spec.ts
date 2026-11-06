import {Test, TestingModule} from "@nestjs/testing";
import {SchemaModule} from "@spica-server/core-schema";
import {contractSuite} from "@spica-server/database-testing";
import {COLLECTION_NAMES, CollectionNames} from "@spica-server/interface-data";
import {SchemaResolver} from "@spica-server/function-webhook/src/schema";

contractSuite("Schema Resolver", engine => {
  let resolver: SchemaResolver;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [engine.module(), SchemaModule.forChild()],
      providers: [SchemaResolver]
    }).compile();
    resolver = module.get(SchemaResolver);
  });

  afterEach(async () => await module.close());

  it("should not resolve schema", () => {
    expect(resolver.resolve("")).not.toBeTruthy();
  });

  it("should resolve the inital schema", async () => {
    const collections = await module.get<CollectionNames>(COLLECTION_NAMES).list();
    const schema = await resolver.resolve("http://spica.internal/webhook");

    expect(schema).toEqual({
      $id: "http://spica.internal/webhook",
      type: "object",
      required: ["title", "url", "body", "trigger"],
      additionalProperties: false,
      properties: {
        title: {
          type: "string",
          title: "Title",
          description: "Title of the webhook"
        },
        url: {
          type: "string",
          title: "Url",
          description: "URL that the post request will be sent to",
          pattern:
            "^(http:\\/\\/www\\.|https:\\/\\/www\\.|http:\\/\\/|https:\\/\\/)?[a-z0-9]+([\\-\\.]{1}[a-z0-9]+)*\\.[a-z]{2,5}(:[0-9]{1,5})?(\\/.*)?|^((http:\\/\\/www\\.|https:\\/\\/www\\.|http:\\/\\/|https:\\/\\/)?([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$"
        },
        body: {type: "string", title: "Template of the body"},
        trigger: {
          type: "object",
          required: ["name", "options"],
          description: "The condition that must be met for sending a request to URL",
          properties: {
            name: {type: "string", enum: ["database"], description: "Name of the trigger type"},
            active: {
              type: "boolean",
              title: "Active",
              default: true,
              description: "Whether this trigger is active"
            },
            options: {
              type: "object",
              required: ["collection", "type"],
              properties: {
                collection: {
                  type: "string",
                  title: "Collection",
                  enum: collections,
                  description: "Target collection that event must be perfomed on"
                },
                type: {
                  type: "string",
                  title: "Event type",
                  enum: ["INSERT", "UPDATE", "REPLACE", "DELETE"],
                  description: "Event type that must be performed in the specified collection"
                }
              }
            }
          }
        }
      }
    });
  });
});
