import {Test} from "@nestjs/testing";
import {ChangeStream, DatabaseService, DatabaseTestingModule, stream} from "@spica/database";
import {DatabaseEnqueuer} from "@spica/api/src/function/enqueuer";
import {DatabaseQueue, EventQueue} from "@spica/api/src/function/queue";
import {Database, event} from "@spica/api/src/function/queue/proto";

function createTarget(cwd?: string, handler?: string) {
  const target = new event.Target();
  target.cwd = cwd || "/tmp/fn1";
  target.handler = handler || "default";
  return target;
}

describe("DatabaseEnqueuer", () => {
  let eventQueue: jasmine.SpyObj<EventQueue>;
  let databaseQueue: jasmine.SpyObj<DatabaseQueue>;
  let noopTarget: event.Target;
  let databaseEnqueuer: DatabaseEnqueuer;
  let database: DatabaseService;

  let schedulerUnsubscriptionSpy: jasmine.Spy;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.replicaSet()]
    }).compile();

    database = module.get(DatabaseService);

    noopTarget = createTarget();

    eventQueue = jasmine.createSpyObj("eventQueue", ["enqueue"]);
    databaseQueue = jasmine.createSpyObj("databaseQueue", ["enqueue"]);

    schedulerUnsubscriptionSpy = jasmine.createSpy("unsubscription", () => {});
    databaseEnqueuer = new DatabaseEnqueuer(
      eventQueue,
      databaseQueue,
      database,
      schedulerUnsubscriptionSpy
    );
  });

  it("should subscribe", async () => {
    databaseEnqueuer.subscribe(noopTarget, {collection: "test_collection", type: "INSERT"});
    await stream.wait();

    const streams = databaseEnqueuer["streams"];
    expect(streams.size).toEqual(1);

    const changeStream = Array.from(streams)[0] as ChangeStream & {target: event.Target};
    expect(changeStream.target.cwd).toEqual("/tmp/fn1");
    expect(changeStream.target.handler).toEqual("default");
  });

  it("should unsubscribe", async () => {
    const target1 = createTarget("/tmp/fn1", "handler1");
    const target2 = createTarget("/tmp/fn1", "handler2");
    const target3 = createTarget("/tmp/fn2", "handler1");

    databaseEnqueuer.subscribe(target1, {collection: "test_collection", type: "INSERT"});
    databaseEnqueuer.subscribe(target2, {collection: "test_collection", type: "INSERT"});
    databaseEnqueuer.subscribe(target3, {collection: "test_collection", type: "INSERT"});

    await stream.wait();

    const streams = databaseEnqueuer["streams"];
    const target1Stream = Array.from(streams)[0] as ChangeStream & {target: event.Target};

    databaseEnqueuer.unsubscribe(target1);

    expect(streams.size).toEqual(2);

    const remainedStreams = Array.from(streams) as (ChangeStream & {target: event.Target})[];
    expect([remainedStreams[0].target.cwd, remainedStreams[0].target.handler]).toEqual([
      "/tmp/fn1",
      "handler2"
    ]);
    expect([remainedStreams[1].target.cwd, remainedStreams[1].target.handler]).toEqual([
      "/tmp/fn2",
      "handler1"
    ]);

    expect(target1Stream.isClosed()).toEqual(true);

    expect(schedulerUnsubscriptionSpy).toHaveBeenCalledOnceWith(target1.id);
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
