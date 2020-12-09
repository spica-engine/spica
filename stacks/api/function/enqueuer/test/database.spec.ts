import {Test} from "@nestjs/testing";
import {DatabaseService, DatabaseTestingModule, stream} from "@spica-server/database/testing";
import {DatabaseEnqueuer} from "@spica-server/function/enqueuer";
import {DatabaseQueue, EventQueue} from "@spica-server/function/queue";
import {Database, event} from "@spica-server/function/queue/proto";

describe("DatabaseEnqueuer", () => {
  let eventQueue: jasmine.SpyObj<EventQueue>;
  let databaseQueue: jasmine.SpyObj<DatabaseQueue>;
  let noopTarget: event.Target;
  let databaseEnqueuer: DatabaseEnqueuer;
  let database: DatabaseService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.replicaSet()]
    }).compile();
    database = module.get(DatabaseService);

    noopTarget = new event.Target();
    noopTarget.cwd = "/tmp/fn1";
    noopTarget.handler = "default";

    eventQueue = jasmine.createSpyObj("eventQueue", ["enqueue"]);
    databaseQueue = jasmine.createSpyObj("databaseQueue", ["enqueue"]);
    databaseEnqueuer = new DatabaseEnqueuer(eventQueue, databaseQueue, database);
  });

  it("should enqueue INSERT events", async () => {
    databaseEnqueuer.subscribe(noopTarget, {collection: "test_collection", type: "INSERT"});

    await stream.wait();
    await database.collection("test_collection").insertOne({test: true});
    await stream.change.wait();
    expect(eventQueue.enqueue).toHaveBeenCalledTimes(1);
    expect(databaseQueue.enqueue).toHaveBeenCalledTimes(1);
    const change = databaseQueue.enqueue.calls.mostRecent().args[1];
    expect(change.collection).toBe("test_collection");
    expect(change.kind).toBe(Database.Change.Kind.INSERT);
  });

  it("should enqueue UPDATE events", async () => {
    const coll = database.collection("test_collection");

    const insertedId = (await coll.insertOne({test: true})).insertedId;

    databaseEnqueuer.subscribe(noopTarget, {collection: "test_collection", type: "UPDATE"});
    await stream.wait();
    await coll.updateOne({}, {$set: {test: false}});
    await stream.change.wait();

    expect(eventQueue.enqueue).toHaveBeenCalledTimes(1);
    expect(databaseQueue.enqueue).toHaveBeenCalledTimes(1);
    const change = databaseQueue.enqueue.calls.mostRecent().args[1];
    expect(change.collection).toBe("test_collection");
    expect(change.documentKey).toBe(insertedId.toHexString());
    expect(change.kind).toBe(Database.Change.Kind.UPDATE);
    expect(change.updateDescription.updatedFields).toEqual('{"test":false}');
  });

  it("should enqueue DELETE events", async () => {
    const coll = database.collection("test_collection");

    const insertedId = (await coll.insertOne({test: true})).insertedId;

    databaseEnqueuer.subscribe(noopTarget, {collection: "test_collection", type: "DELETE"});

    await stream.wait();
    await coll.deleteMany({});
    await stream.change.wait();

    expect(eventQueue.enqueue).toHaveBeenCalledTimes(1);
    expect(databaseQueue.enqueue).toHaveBeenCalledTimes(1);
    const change = databaseQueue.enqueue.calls.mostRecent().args[1];
    expect(change.collection).toBe("test_collection");
    expect(change.documentKey).toBe(insertedId.toHexString());
    expect(change.kind).toBe(Database.Change.Kind.DELETE);
  });
});
