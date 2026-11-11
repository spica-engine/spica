import {TestingModule, Test} from "@nestjs/testing";
import {contractSuite} from "@spica-server/database-testing";
import {BUCKET_WRITE, BucketWriteFacade} from "@spica-server/interface-bucket-common";
import {
  CHANGE_FEED,
  ChangeEvent,
  ChangeFeed,
  ChangeFeedOptions
} from "@spica-server/interface-data";
import {BucketStore, bucketStoreProviders, createBucketStore} from "./bucket-store.js";

const SETTLE_MS = 600;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

contractSuite("change feed", engine => {
  let module: TestingModule;
  let store: BucketStore;
  let feed: ChangeFeed & {ready?: () => Promise<void>};
  let writes: BucketWriteFacade;
  let bucket: any;
  const known = new Map<string, any>();
  const subscriptions: {unsubscribe(): void}[] = [];

  const context = () => ({
    resolveSchema: (id: unknown) => known.get(String(id)),
    deleteOne: jest.fn()
  });
  const collection = () => `bucket_${bucket._id}`;
  const keyOf = (saved: any) => String(saved[store.keyField]);

  async function listen(options?: ChangeFeedOptions) {
    const events: ChangeEvent[] = [];
    subscriptions.push(feed.watch(collection(), options).subscribe(event => events.push(event)));
    await feed.ready?.();
    await sleep(SETTLE_MS);
    return events;
  }

  async function eventually(events: ChangeEvent[], count: number) {
    for (let waited = 0; waited < 10_000 && events.length < count; waited += 50) {
      await sleep(50);
    }
    return events;
  }

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [engine.module()],
      providers: bucketStoreProviders(engine)
    }).compile();
    await module.init();
    store = createBucketStore(engine, module);
    feed = module.get(CHANGE_FEED);
    writes = module.get(BUCKET_WRITE);
  }, 120_000);

  afterAll(() => module.close());

  beforeEach(async () => {
    bucket = await store.createBucket({
      title: {type: "string"},
      age: {type: "number"}
    });
    known.set(String(bucket._id), bucket);
  });

  afterEach(() => subscriptions.splice(0).forEach(subscription => subscription.unsubscribe()));

  const insert = (document: object) => writes.insert(bucket, {...document}, {}, context());

  it("should emit an insert with the document", async () => {
    const events = await listen();

    const saved = await insert({title: "first", age: 1});
    await eventually(events, 1);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      operation: "insert",
      collection: collection(),
      key: keyOf(saved),
      document: {title: "first", age: 1}
    });
    expect(events[0].id).toEqual(expect.any(String));
  });

  it("should emit an update with the changed fields", async () => {
    const saved = await insert({title: "before", age: 1});
    const events = await listen({operations: ["update"], document: "current"});

    await writes.patch(bucket, {...saved, title: "after"}, {title: "after"}, {}, context());
    await eventually(events, 1);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      operation: "update",
      key: keyOf(saved),
      document: {title: "after", age: 1},
      changes: {updated: {title: "after"}, removed: []}
    });
  });

  it("should emit a delete with the key", async () => {
    const saved = await insert({title: "gone"});
    const events = await listen({operations: ["delete"]});

    await writes.delete(bucket, keyOf(saved), {}, context());
    await eventually(events, 1);

    expect(events).toEqual([
      expect.objectContaining({operation: "delete", collection: collection(), key: keyOf(saved)})
    ]);
  });

  it("should emit only the requested operations", async () => {
    const events = await listen({operations: ["insert", "delete"]});

    const saved = await insert({title: "a"});
    await writes.patch(bucket, {...saved, title: "b"}, {title: "b"}, {}, context());
    await writes.delete(bucket, keyOf(saved), {}, context());
    await eventually(events, 2);
    await sleep(SETTLE_MS);

    expect(events.map(event => event.operation)).toEqual(["insert", "delete"]);
  });

  it("should emit the same id to every subscriber of a change", async () => {
    const first = await listen({operations: ["insert"]});
    const second = await listen({operations: ["insert"]});

    await insert({title: "shared"});
    await eventually(first, 1);
    await eventually(second, 1);

    expect(first[0].id).toEqual(second[0].id);
  });

  it("should stop emitting after unsubscribe", async () => {
    const events: ChangeEvent[] = [];
    const subscription = feed.watch(collection()).subscribe(event => events.push(event));
    await feed.ready?.();
    await sleep(SETTLE_MS);
    subscription.unsubscribe();

    await insert({title: "unheard"});
    await sleep(SETTLE_MS);

    expect(events).toEqual([]);
  });
});
