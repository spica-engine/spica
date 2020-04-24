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
      properties: {
        url: {type: "string", title: "Url", format: "url"},
        trigger: {
          type: "object",
          properties: {
            name: {type: "string", enum: ["database"]},
            active: {type: "boolean", title: "Active", default: true},
            options: {
              type: "object",
              properties: {
                collection: {type: "string", title: "Collection", enum: ["test"]},
                type: {
                  type: "string",
                  title: "Event type",
                  enum: ["INSERT", "UPDATE", "REPLACE", "DELETE"]
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
