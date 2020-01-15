import {Test} from "@nestjs/testing";
import {DatabaseService, DatabaseTestingModule} from "@spica-server/database/testing";
import {DatabaseEnqueuer} from "@spica-server/function/enqueuer";
import {DatabaseQueue, EventQueue} from "@spica-server/function/queue";
import {Database, Event} from "@spica-server/function/queue/proto";

describe("DatabaseEnqueuer", () => {
  let eventQueue: jasmine.SpyObj<EventQueue>;
  let databaseQueue: jasmine.SpyObj<DatabaseQueue>;
  let noopTarget: Event.Target;
  let databaseEnqueuer: DatabaseEnqueuer;
  let database: DatabaseService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.replicaSet()]
    }).compile();
    database = module.get(DatabaseService);

    noopTarget = new Event.Target();
    noopTarget.cwd = "/tmp/fn1";
    noopTarget.handler = "default";

    eventQueue = jasmine.createSpyObj("eventQueue", ["enqueue"]);
    databaseQueue = jasmine.createSpyObj("httpQueue", ["enqueue"]);
    databaseEnqueuer = new DatabaseEnqueuer(eventQueue, databaseQueue, database);
  }, 7000);

  it("should enqueue INSERT events", async done => {
    databaseEnqueuer.subscribe(noopTarget, {collection: "test_collection", type: "INSERT"});

    setTimeout(() => {
      expect(eventQueue.enqueue).toHaveBeenCalledTimes(1);
      expect(databaseQueue.enqueue).toHaveBeenCalledTimes(1);
      const change = databaseQueue.enqueue.calls.mostRecent().args[1];
      expect(change.collection).toBe("test_collection");
      expect(change.kind).toBe(Database.Change.Kind.INSERT);
      done();
    }, 500);

    setTimeout(() => database.collection("test_collection").insertOne({test: true}), 50);
  });

  it("should enqueue UPDATE events", async done => {
    const coll = database.collection("test_collection");

    const insertedId = (await coll.insertOne({test: true})).insertedId;

    databaseEnqueuer.subscribe(noopTarget, {collection: "test_collection", type: "UPDATE"});

    setTimeout(() => {
      expect(eventQueue.enqueue).toHaveBeenCalledTimes(1);
      expect(databaseQueue.enqueue).toHaveBeenCalledTimes(1);
      const change = databaseQueue.enqueue.calls.mostRecent().args[1];
      expect(change.collection).toBe("test_collection");
      expect(change.documentKey).toBe(insertedId.toHexString());
      expect(change.kind).toBe(Database.Change.Kind.UPDATE);
      done();
    }, 500);

    setTimeout(() => coll.updateOne({}, {$set: {test: false}}), 50);
  });

  it("should enqueue DELETE events", async done => {
    const coll = database.collection("test_collection");

    const insertedId = (await coll.insertOne({test: true})).insertedId;

    databaseEnqueuer.subscribe(noopTarget, {collection: "test_collection", type: "DELETE"});

    setTimeout(() => {
      expect(eventQueue.enqueue).toHaveBeenCalledTimes(1);
      expect(databaseQueue.enqueue).toHaveBeenCalledTimes(1);
      const change = databaseQueue.enqueue.calls.mostRecent().args[1];
      expect(change.collection).toBe("test_collection");
      expect(change.documentKey).toBe(insertedId.toHexString());
      expect(change.kind).toBe(Database.Change.Kind.DELETE);
      done();
    }, 500);

    setTimeout(() => coll.deleteMany({}), 50);
  });
});
