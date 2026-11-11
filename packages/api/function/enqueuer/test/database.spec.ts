import {Test, TestingModule} from "@nestjs/testing";
import {provideRepository} from "@spica-server/data";
import {changeFeedReady, ContractEngine, contractSuite} from "@spica-server/database-testing";
import {DatabaseEnqueuer} from "@spica-server/function-enqueuer";
import {DatabaseQueue, EventQueue} from "@spica-server/function-queue";
import {Database, event} from "@spica-server/function-queue-proto";
import {
  BUCKET_DATA_REPOSITORY,
  BUCKET_REPOSITORY,
  BUCKET_SCHEMA_MANAGER
} from "@spica-server/interface-bucket";
import {BUCKET_WRITE, BucketWriteFacade} from "@spica-server/interface-bucket-common";
import {CHANGE_FEED} from "@spica-server/interface-data";
import {JOB_REPOSITORY, REPLICATION_SERVICE_OPTIONS} from "@spica-server/interface-replication";
import {JobReducer} from "@spica-server/replication";

function createTarget(cwd = "/tmp/fn1", handler = "default") {
  const target = new event.Target();
  target.cwd = cwd;
  target.handler = handler;
  target.context = new event.SchedulingContext({timeout: 10});
  return target;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function until(condition: () => boolean) {
  for (let waited = 0; waited < 10_000 && !condition(); waited += 25) {
    await sleep(25);
  }
}

const SETTLE_MS = 500;

let buckets = 0;

contractSuite("DatabaseEnqueuer", engine => {
  const mongo = engine.name == "mongodb";
  let modules: TestingModule[];
  let eventQueue: {enqueue: jest.Mock};
  let databaseQueue: {enqueue: jest.Mock};
  let bucket: any;
  let collection: string;
  let writes: BucketWriteFacade;
  let enqueuer: DatabaseEnqueuer;
  const enqueuers = new Map<DatabaseEnqueuer, TestingModule>();

  const keyField = mongo ? "_id" : "id";
  const context = () => ({resolveSchema: () => bucket, deleteOne: jest.fn()});
  const insert = (document: object) => writes.insert(bucket, {...document}, {}, context());
  const patch = (document: object, changes: object) =>
    writes.patch(bucket, document as any, changes, {}, context());

  const compileModule = (shareWith?: TestingModule) =>
    Test.createTestingModule({
      imports: [shareWith ? engine.sharing(shareWith) : engine.module()],
      providers: [
        {provide: REPLICATION_SERVICE_OPTIONS, useValue: {expireAfterSeconds: 60}},
        provideRepository(BUCKET_REPOSITORY),
        provideRepository(BUCKET_SCHEMA_MANAGER),
        provideRepository(BUCKET_DATA_REPOSITORY),
        provideRepository(JOB_REPOSITORY)
      ]
    })
      .compile()
      .then(async module => {
        modules.push(module);
        await module.init();
        return module;
      });

  const enqueuerOf = (module: TestingModule, queues = {eventQueue, databaseQueue}) => {
    const created = new DatabaseEnqueuer(
      queues.eventQueue as unknown as EventQueue,
      queues.databaseQueue as unknown as DatabaseQueue,
      module.get(CHANGE_FEED),
      new JobReducer(module.get(JOB_REPOSITORY))
    );
    enqueuers.set(created, module);
    return created;
  };

  const changes = (queue = databaseQueue) => queue.enqueue.mock.calls.map(([, change]) => change);

  beforeAll(async () => {
    modules = [];
    const module = await compileModule();
    writes = module.get(BUCKET_WRITE);
    bucket = await module.get(BUCKET_SCHEMA_MANAGER).create(
      {
        title: `enqueuer ${++buckets}`,
        description: "",
        icon: "",
        primary: mongo ? "title" : "id",
        readOnly: false,
        history: false,
        order: 0,
        acl: {read: "true==true", write: "true==true"},
        properties: mongo
          ? {title: {type: "string"}, done: {type: "boolean"}}
          : {
              id: {type: "uuid", options: {generated: true}},
              title: {type: "string"},
              done: {type: "boolean"}
            }
      } as any,
      () => {}
    );
    collection = `bucket_${bucket._id}`;
  }, 120_000);

  afterAll(async () => {
    await Promise.all(modules.map(module => module.close()));
  });

  beforeEach(async () => {
    eventQueue = {enqueue: jest.fn()};
    databaseQueue = {enqueue: jest.fn()};
    enqueuer = enqueuerOf(modules[0]);
  });

  afterEach(() => {
    for (const created of enqueuers.keys()) {
      for (const cwd of ["/tmp/fn1", "/tmp/fn2"]) {
        const whole = new event.Target();
        whole.cwd = cwd;
        created.unsubscribe(whole);
      }
    }
    enqueuers.clear();
  });

  async function subscribe(
    type: "INSERT" | "UPDATE" | "REPLACE" | "DELETE",
    target = createTarget(),
    subscriber = enqueuer
  ) {
    subscriber.subscribe(target, {collection, type});
    await changeFeedReady(enqueuers.get(subscriber));
  }

  it("should enqueue INSERT events", async () => {
    await subscribe("INSERT");

    const saved = await insert({title: "first", done: false});
    await until(() => eventQueue.enqueue.mock.calls.length == 1);

    expect(eventQueue.enqueue).toHaveBeenCalledTimes(1);
    const [change] = changes();
    expect(change.collection).toBe(collection);
    expect(change.kind).toBe(Database.Change.Kind.INSERT);
    expect(change.documentKey).toBe(String(saved[keyField]));
    expect(JSON.parse(change.document)).toMatchObject({title: "first", done: false});
  });

  it("should enqueue UPDATE events with the changed fields", async () => {
    const saved = await insert({title: "before", done: false});
    await subscribe("UPDATE");

    await patch({...saved, done: true}, {done: true});
    await until(() => eventQueue.enqueue.mock.calls.length == 1);

    expect(eventQueue.enqueue).toHaveBeenCalledTimes(1);
    const [change] = changes();
    expect(change.kind).toBe(Database.Change.Kind.UPDATE);
    expect(change.documentKey).toBe(String(saved[keyField]));
    expect(change.updateDescription.updatedFields).toEqual('{"done":true}');
    expect(change.updateDescription.removedFields).toEqual("[]");
  });

  it("should enqueue DELETE events", async () => {
    const saved = await insert({title: "gone"});
    await subscribe("DELETE");

    await writes.delete(bucket, String(saved[keyField]), {}, context());
    await until(() => eventQueue.enqueue.mock.calls.length == 1);

    expect(eventQueue.enqueue).toHaveBeenCalledTimes(1);
    const [change] = changes();
    expect(change.kind).toBe(Database.Change.Kind.DELETE);
    expect(change.documentKey).toBe(String(saved[keyField]));
  });

  it("should enqueue only the subscribed type", async () => {
    await subscribe("DELETE");

    const saved = await insert({title: "kept"});
    await patch({...saved, done: true}, {done: true});
    await sleep(SETTLE_MS);

    expect(eventQueue.enqueue).not.toHaveBeenCalled();
  });

  it("should enqueue for every subscribed target", async () => {
    await subscribe("INSERT", createTarget("/tmp/fn1", "handler1"));
    await subscribe("INSERT", createTarget("/tmp/fn2", "handler1"));

    await insert({title: "both"});
    await until(() => eventQueue.enqueue.mock.calls.length == 2);

    const targets = eventQueue.enqueue.mock.calls.map(([enqueued]) => [
      enqueued.target.cwd,
      enqueued.target.handler
    ]);
    expect(targets.sort()).toEqual([
      ["/tmp/fn1", "handler1"],
      ["/tmp/fn2", "handler1"]
    ]);
  });

  describe("unsubscribe", () => {
    it("should stop only the targets asked for", async () => {
      const target1 = createTarget("/tmp/fn1", "handler1");
      await subscribe("INSERT", target1);
      await subscribe("INSERT", createTarget("/tmp/fn1", "handler2"));
      await subscribe("INSERT", createTarget("/tmp/fn2", "handler1"));

      enqueuer.unsubscribe(target1);
      await insert({title: "after"});
      await until(() => eventQueue.enqueue.mock.calls.length == 2);
      await sleep(SETTLE_MS);

      const targets = eventQueue.enqueue.mock.calls.map(([enqueued]) => [
        enqueued.target.cwd,
        enqueued.target.handler
      ]);
      expect(targets.sort()).toEqual([
        ["/tmp/fn1", "handler2"],
        ["/tmp/fn2", "handler1"]
      ]);
    });

    it("should stop every handler of a function when no handler is given", async () => {
      await subscribe("INSERT", createTarget("/tmp/fn1", "handler1"));
      await subscribe("INSERT", createTarget("/tmp/fn1", "handler2"));
      const kept = createTarget("/tmp/fn2", "handler1");
      await subscribe("INSERT", kept);

      const whole = new event.Target();
      whole.cwd = "/tmp/fn1";
      enqueuer.unsubscribe(whole);
      await insert({title: "after"});
      await until(() => eventQueue.enqueue.mock.calls.length == 1);
      await sleep(SETTLE_MS);

      expect(eventQueue.enqueue).toHaveBeenCalledTimes(1);
      expect(eventQueue.enqueue.mock.calls[0][0].target.cwd).toBe("/tmp/fn2");
    });
  });

  describe("replicas", () => {
    it("should enqueue a change on one replica only", async () => {
      const second = {eventQueue: {enqueue: jest.fn()}, databaseQueue: {enqueue: jest.fn()}};
      const other = await compileModule(modules[0]);
      const otherEnqueuer = enqueuerOf(other, second);
      await subscribe("INSERT");
      await subscribe("INSERT", createTarget(), otherEnqueuer);

      await insert({title: "once"});
      await until(
        () => eventQueue.enqueue.mock.calls.length + second.eventQueue.enqueue.mock.calls.length > 0
      );
      await sleep(SETTLE_MS);

      expect(
        eventQueue.enqueue.mock.calls.length + second.eventQueue.enqueue.mock.calls.length
      ).toBe(1);
    });

    it("should enqueue the change again from the stored job once the event is drained", async () => {
      await subscribe("INSERT");
      const saved = await insert({title: "drained", done: true});
      await until(() => eventQueue.enqueue.mock.calls.length == 1);
      const [first] = eventQueue.enqueue.mock.calls[0];

      await enqueuer.onEventsAreDrained([first]);
      await until(() => eventQueue.enqueue.mock.calls.length == 2);

      expect(eventQueue.enqueue).toHaveBeenCalledTimes(2);
      const [again, original] = changes().reverse();
      expect(again.kind).toBe(Database.Change.Kind.INSERT);
      expect(again.documentKey).toBe(String(saved[keyField]));
      expect(again.collection).toBe(collection);
      expect(JSON.parse(again.document)).toEqual(JSON.parse(original.document));
      expect(eventQueue.enqueue.mock.calls[1][0].id).toBe(first.id);
    });
  });
});
