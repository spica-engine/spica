import {Test, TestingModule} from "@nestjs/testing";
import {
  ChangeStream,
  createAdHocCollection,
  DatabaseService,
  DatabaseTestingModule,
  probeWatch,
  WatchProbe
} from "@spica-server/database-testing";
import {DatabaseEnqueuer} from "@spica-server/function-enqueuer";
import {DatabaseQueue, EventQueue} from "@spica-server/function-queue";
import {Database, event} from "@spica-server/function-queue-proto";

function createTarget(cwd?: string, handler?: string) {
  const target = new event.Target();
  target.cwd = cwd || "/tmp/fn1";
  target.handler = handler || "default";
  return target;
}

describe("DatabaseEnqueuer", () => {
  let eventQueue: {enqueue: jest.Mock};
  let databaseQueue: {enqueue: jest.Mock};
  let noopTarget: event.Target;
  let databaseEnqueuer: DatabaseEnqueuer;
  let database: DatabaseService;
  let probe: WatchProbe;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.replicaSet()]
    }).compile();

    database = module.get(DatabaseService);

    /**
     * The collection is created **beforehand**. MongoDB can watch a namespace that does not exist, while a
     * relational model needs a table to watch — and in production a database trigger also only targets
     * collections that exist.
     */
    await createAdHocCollection(database, "test_collection", {test: {type: "boolean"}});

    /**
     * the neutral probe. The old `stream` shim patched `Db.prototype`, so it worked on MongoDB only;
     * this call observes whichever backend was injected.
     */
    probe = probeWatch(database);

    noopTarget = createTarget();

    eventQueue = {
      enqueue: jest.fn()
    };
    databaseQueue = {
      enqueue: jest.fn()
    };

    databaseEnqueuer = new DatabaseEnqueuer(eventQueue as any, databaseQueue as any, database);
  });

  /**
   * The subscriptions have to be dropped, and the module closed, before the next test.
   *
   * Every test used to leave a live change stream behind. On MongoDB that is close to harmless; on
   * PostgreSQL a subscription owns a polling timer that keeps querying the pool, so once the pool was
   * ended the drain raised `Cannot use a pool after calling end on the pool` — and jest attributes an
   * async error to whatever test is running, which is why it surfaced two spec files later, in
   * `grpc.spec.ts`. The leak was here.
   */
  afterEach(async () => {
    for (const subscription of databaseEnqueuer["streams"]) subscription.unsubscribe();
    databaseEnqueuer["streams"].clear();
    await module.close();
  });

  it("should subscribe", async () => {
    databaseEnqueuer.subscribe(noopTarget, {collection: "test_collection", type: "INSERT"});
    await probe.wait();

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

    await probe.wait();

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

    expect(target1Stream.closed).toEqual(true);
  });

  it("should enqueue INSERT events", async () => {
    databaseEnqueuer.subscribe(noopTarget, {collection: "test_collection", type: "INSERT"});

    await probe.wait();
    await database.collection("test_collection").insertOne({test: true});
    await probe.change.wait();
    expect(eventQueue.enqueue).toHaveBeenCalledTimes(1);
    expect(databaseQueue.enqueue).toHaveBeenCalledTimes(1);
    const change = databaseQueue.enqueue.mock.calls[databaseQueue.enqueue.mock.calls.length - 1][1];
    expect(change.collection).toBe("test_collection");
    expect(change.kind).toBe(Database.Change.Kind.INSERT);
  });

  it("should enqueue UPDATE events", async () => {
    const coll = database.collection("test_collection");

    const insertedId = (await coll.insertOne({test: true}))._id;

    databaseEnqueuer.subscribe(noopTarget, {collection: "test_collection", type: "UPDATE"});
    await probe.wait();
    await coll.updateOne({}, {$set: {test: false}});
    await probe.change.wait();

    expect(eventQueue.enqueue).toHaveBeenCalledTimes(1);
    expect(databaseQueue.enqueue).toHaveBeenCalledTimes(1);
    const change = databaseQueue.enqueue.mock.calls[databaseQueue.enqueue.mock.calls.length - 1][1];
    expect(change.collection).toBe("test_collection");
    expect(change.documentKey).toBe(insertedId.toHexString());
    expect(change.kind).toBe(Database.Change.Kind.UPDATE);
    expect(change.updateDescription.updatedFields).toEqual('{"test":false}');
  });

  it("should enqueue DELETE events", async () => {
    const coll = database.collection("test_collection");

    const insertedId = (await coll.insertOne({test: true}))._id;

    databaseEnqueuer.subscribe(noopTarget, {collection: "test_collection", type: "DELETE"});

    await probe.wait();
    await coll.deleteMany({});
    await probe.change.wait();

    expect(eventQueue.enqueue).toHaveBeenCalledTimes(1);
    expect(databaseQueue.enqueue).toHaveBeenCalledTimes(1);
    const change = databaseQueue.enqueue.mock.calls[databaseQueue.enqueue.mock.calls.length - 1][1];
    expect(change.collection).toBe("test_collection");
    expect(change.documentKey).toBe(insertedId.toHexString());
    expect(change.kind).toBe(Database.Change.Kind.DELETE);
  });
});
