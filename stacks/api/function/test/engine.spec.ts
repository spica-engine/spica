import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseService, MongoClient} from "@spica-server/database";
import {DatabaseTestingModule, stream} from "@spica-server/database/testing";
import {Horizon, HorizonModule} from "@spica-server/function/horizon";
import {FunctionEngine, getDatabaseSchema} from "@spica-server/function/src/engine";
import {ChangeKind, FunctionService, TargetChange} from "../src/function.service";
import {take, bufferCount} from "rxjs/operators";
import {from} from "rxjs";

describe("engine", () => {
  let engine: FunctionEngine;
  let subscribeSpy: jasmine.Spy;
  let unsubscribeSpy: jasmine.Spy;

  let horizon: Horizon;
  let database: DatabaseService;
  let mongo: MongoClient;

  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [HorizonModule, DatabaseTestingModule.replicaSet()]
    }).compile();

    horizon = module.get(Horizon);
    database = module.get(DatabaseService);
    mongo = module.get(MongoClient);

    engine = new FunctionEngine(
      new FunctionService(database),
      database,
      mongo,
      horizon,
      {root: "test_root"},
      null
    );

    subscribeSpy = spyOn<any>(engine, "subscribe").and.returnValue(null);
    unsubscribeSpy = spyOn<any>(engine, "unsubscribe").and.returnValue(null);
  }, 120000);

  afterEach(async () => {
    subscribeSpy.calls.reset();
    unsubscribeSpy.calls.reset();
    await module.close();
  });

  it("should subscribe to new trigger if ChangeKind is Added", () => {
    let changes: TargetChange = {
      kind: ChangeKind.Added,
      target: {
        id: "test_id",
        handler: "test_handler"
      }
    };

    engine["categorizeChanges"]([changes]);

    expect(subscribeSpy).toHaveBeenCalledTimes(1);
    expect(subscribeSpy).toHaveBeenCalledWith(changes);

    expect(unsubscribeSpy).toHaveBeenCalledTimes(0);
  });

  it("should unsubscribe from removed trigger if ChangeKind is Removed", () => {
    let changes: TargetChange = {
      kind: ChangeKind.Removed,
      target: {
        id: "test_id",
        handler: "test_handler"
      }
    };

    engine["categorizeChanges"]([changes]);

    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
    expect(unsubscribeSpy).toHaveBeenCalledWith("test_root/test_id");

    expect(subscribeSpy).toHaveBeenCalledTimes(0);
  });

  it("should call unsubscribe for once then call subsribe for all triggers if ChangeKind is Updated", () => {
    let changes: TargetChange[] = [
      {
        kind: ChangeKind.Updated,
        target: {
          id: "test_id",
          handler: "test_handler"
        }
      },
      {
        kind: ChangeKind.Updated,
        target: {
          id: "test_id",
          handler: "test_handler2"
        }
      }
    ];

    engine["categorizeChanges"](changes);

    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
    expect(unsubscribeSpy).toHaveBeenCalledWith("test_root/test_id");

    expect(subscribeSpy).toHaveBeenCalledTimes(2);
    expect(subscribeSpy.calls.all().map(call => call.args)).toEqual([[changes[0]], [changes[1]]]);
  });

  describe("Database Schema", () => {
    it("should get initial schema", async () => {
      let schema = await from(engine.getSchema("database"))
        .pipe(take(1))
        .toPromise();
      expect(schema).toEqual({
        $id: "http://spica.internal/function/enqueuer/database",
        type: "object",
        required: ["collection", "type"],
        properties: {
          collection: {
            title: "Collection Name",
            type: "string",
            enum: []
          },
          type: {
            title: "Operation type",
            description: "Event Type",
            type: "string",
            enum: ["INSERT", "UPDATE", "REPLACE", "DELETE"]
          }
        },
        additionalProperties: false
      });
    });

    it("should report when a collection has been created", async done => {
      const schema = engine.getSchema("database");
      await database.collection("initial").insertMany([{}, {}]);
      from(schema)
        .pipe(
          bufferCount(2),
          take(1)
        )
        .subscribe(changes => {
          let collections = changes.map(c => c.properties.collection["enum"]);
          expect(collections).toEqual([["initial"], ["initial", "inserted"]]);
          done();
        });
      await stream.wait();
      await database.collection("inserted").insertOne({});
    });

    it("should report when a collection has been dropped", async done => {
      const schema = engine.getSchema("database");
      await database.collection("initial").insertMany([{}, {}]);
      from(schema)
        .pipe(
          bufferCount(2),
          take(1)
        )
        .subscribe(changes => {
          let collections = changes.map(c => c.properties.collection["enum"]);
          expect(collections).toEqual([["initial"], []]);
          done();
        });
      await stream.wait();
      await database.collection("initial").drop();
    });
  });
});
