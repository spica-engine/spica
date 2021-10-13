import {Test, TestingModule} from "@nestjs/testing";
import {SchemaModule} from "@spica-server/core/schema";
import {DatabaseService, DatabaseTestingModule, stream} from "@spica-server/database/testing";
import {SchemaResolver} from "@spica-server/function/webhook/src/schema";
import {bufferCount, take} from "rxjs/operators";

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

describe("Schema Resolver", () => {
  let resolver: SchemaResolver;
  let module: TestingModule;
  let db: DatabaseService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.replicaSet(), SchemaModule.forChild()],
      providers: [SchemaResolver]
    }).compile();
    resolver = module.get(SchemaResolver);
    db = module.get(DatabaseService);
  });

  afterEach(async () => await module.close());

  it("should not resolve schema", () => {
    expect(resolver.resolve("")).not.toBeTruthy();
  });

  it("should resolve the inital schema", async () => {
    const schema = resolver.resolve("http://spica.internal/webhook");
    await db.collection("test").insertOne({});
    await expectAsync(schema.pipe(take(1)).toPromise()).toBeResolvedTo({
      $id: "http://spica.internal/webhook",
      type: "object",
      required: ["url", "body", "trigger"],
      properties: {
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
                  enum: ["test"],
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

  it("should report when a collection has been created", async done => {
    const schema = resolver.resolve("http://spica.internal/webhook");
    await db.collection("test").insertMany([{}, {}]);
    schema
      .pipe(
        bufferCount(2),
        take(1)
      )
      .subscribe(changes => {
        changes = changes.map(
          c => c.properties.trigger["properties"].options.properties.collection.enum
        );
        expect(changes as unknown).toEqual([["test"], ["test", "testing"]]);
        done();
      });
    await stream.wait();
    await db.collection("testing").insertOne({});
  });

  it("should report when a collection has been dropped", async done => {
    const schema = resolver.resolve("http://spica.internal/webhook");
    const coll = db.collection("test");
    await coll.insertOne({});
    schema
      .pipe(
        bufferCount(2),
        take(1)
      )
      .subscribe(changes => {
        changes = changes.map(
          c => c.properties.trigger["properties"].options.properties.collection.enum
        );
        expect(changes as unknown).toEqual([["test"], []]);
        done();
      });
    await stream.wait();
    await coll.drop();
  });
});
