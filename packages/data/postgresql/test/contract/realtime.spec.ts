import {Test, TestingModule} from "@nestjs/testing";
import {contractSuite} from "@spica-server/database-testing";
import {BUCKET_WRITE, BucketWriteFacade} from "@spica-server/interface-bucket-common";
import {
  ChunkKind,
  REALTIME,
  Realtime,
  RealtimeOptions,
  StreamChunk
} from "@spica-server/interface-realtime";
import {BucketStore, bucketStoreProviders, createBucketStore} from "./bucket-store.js";

const SETTLE_MS = 600;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function until(condition: () => boolean) {
  for (let waited = 0; waited < 15_000 && !condition(); waited += 25) {
    await sleep(25);
  }
}

contractSuite("realtime", engine => {
  const postgres = engine.name == "postgresql";
  const filterOf = (json: object, expression: string) => (postgres ? expression : json);
  let module: TestingModule;
  let store: BucketStore;
  let realtime: Realtime;
  let writes: BucketWriteFacade;
  let bucket: any;
  const known = new Map<string, any>();
  const subscriptions: {unsubscribe(): void}[] = [];

  const collection = () => `bucket_${bucket._id}`;
  const keyOf = (document: any) => String(document?.[store.keyField]);
  const context = () => ({
    resolveSchema: (id: unknown) => known.get(String(id)),
    deleteOne: jest.fn()
  });
  const insert = (document: object) => writes.insert(bucket, {...document}, {}, context());
  const patch = (document: object, changes: object) =>
    writes.patch(bucket, document as any, changes, {}, context());
  const remove = (document: any) => writes.delete(bucket, keyOf(document), {}, context());

  async function open(options: RealtimeOptions = {}) {
    const chunks: StreamChunk<any>[] = [];
    subscriptions.push(
      realtime.find(collection(), options).subscribe({
        next: chunk => chunks.push(chunk),
        error: error => chunks.push({kind: ChunkKind.Error, document: error})
      })
    );
    await until(() => chunks.some(chunk => chunk.kind == ChunkKind.EndOfInitial));
    await sleep(SETTLE_MS);
    const mark = chunks.length;
    return Object.assign(chunks, {live: () => chunks.slice(mark)});
  }

  const kinds = (chunks: StreamChunk<any>[]) => chunks.map(chunk => ChunkKind[chunk.kind]);

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [engine.module()],
      providers: bucketStoreProviders(engine)
    }).compile();
    await module.init();
    store = createBucketStore(engine, module);
    realtime = module.get(REALTIME);
    writes = module.get(BUCKET_WRITE);
  }, 120_000);

  afterAll(() => module.close());

  beforeEach(async () => {
    bucket = await store.createBucket({age: {type: "number"}, title: {type: "string"}});
    known.set(String(bucket._id), bucket);
  });

  afterEach(() => subscriptions.splice(0).forEach(subscription => subscription.unsubscribe()));

  describe("initial documents", () => {
    it("should send every document and mark the end", async () => {
      await insert({age: 10, title: "a"});
      await insert({age: 20, title: "b"});

      const chunks = await open();

      expect(kinds(chunks.slice(0, 3))).toEqual(["Initial", "Initial", "EndOfInitial"]);
      expect(
        chunks
          .slice(0, 2)
          .map(chunk => chunk.document.title)
          .sort()
      ).toEqual(["a", "b"]);
    });

    it("should end right away when the bucket is empty", async () => {
      expect(kinds((await open()).slice(0, 1))).toEqual(["EndOfInitial"]);
    });

    it("should send only the documents that match the filter", async () => {
      await insert({age: 10, title: "a"});
      await insert({age: 20, title: "b"});
      await insert({age: 30, title: "c"});

      const chunks = await open({filter: filterOf({age: {$gt: 15}}, "document.age > 15")});

      expect(
        chunks
          .filter(chunk => chunk.kind == ChunkKind.Initial)
          .map(c => c.document.title)
          .sort()
      ).toEqual(["b", "c"]);
    });

    it("should order the documents by the sort", async () => {
      await insert({age: 30, title: "c"});
      await insert({age: 10, title: "a"});
      await insert({age: 20, title: "b"});

      const chunks = await open({sort: {age: 1}});

      expect(
        chunks.filter(chunk => chunk.kind == ChunkKind.Initial).map(c => c.document.title)
      ).toEqual(["a", "b", "c"]);
    });

    it("should skip and limit", async () => {
      await insert({age: 10, title: "a"});
      await insert({age: 20, title: "b"});
      await insert({age: 30, title: "c"});

      const chunks = await open({sort: {age: 1}, skip: 1, limit: 1});

      expect(
        chunks.filter(chunk => chunk.kind == ChunkKind.Initial).map(c => c.document.title)
      ).toEqual(["b"]);
    });
  });

  describe("changes", () => {
    const matching = () => ({filter: filterOf({age: {$gt: 15}}, "document.age > 15")});

    it("should insert a document that matches", async () => {
      const chunks = await open(matching());

      await insert({age: 20, title: "new"});
      await until(() => chunks.live().length > 0);

      expect(kinds(chunks.live())).toEqual(["Insert"]);
      expect(chunks.live()[0].document.title).toEqual("new");
    });

    it("should stay quiet about a document that does not match", async () => {
      const chunks = await open(matching());

      await insert({age: 1, title: "small"});
      await sleep(SETTLE_MS);

      expect(chunks.live()).toEqual([]);
    });

    it("should update a document the subscriber has", async () => {
      const saved = await insert({age: 20, title: "before"});
      const chunks = await open();

      await patch({...saved, title: "after"}, {title: "after"});
      await until(() => chunks.live().length > 0);

      expect(kinds(chunks.live())).toEqual(["Update"]);
      expect(chunks.live()[0].document.title).toEqual("after");
    });

    it("should expunge a document that stops matching", async () => {
      const saved = await insert({age: 20, title: "x"});
      const chunks = await open(matching());

      await patch({...saved, age: 5}, {age: 5});
      await until(() => chunks.live().length > 0);

      expect(kinds(chunks.live())).toEqual(["Expunge"]);
      expect(keyOf(chunks.live()[0].document)).toEqual(keyOf(saved));
    });

    it("should delete a document the subscriber has", async () => {
      const saved = await insert({age: 20, title: "x"});
      const chunks = await open();

      await remove(saved);
      await until(() => chunks.live().length > 0);

      expect(kinds(chunks.live())).toEqual(["Delete"]);
      expect(keyOf(chunks.live()[0].document)).toEqual(keyOf(saved));
    });

    it("should stop sending after unsubscribe", async () => {
      const chunks: StreamChunk<any>[] = [];
      const subscription = realtime.find(collection()).subscribe(chunk => chunks.push(chunk));
      await until(() => chunks.length > 0);
      subscription.unsubscribe();

      await insert({age: 1, title: "unheard"});
      await sleep(SETTLE_MS);

      expect(kinds(chunks)).toEqual(["EndOfInitial"]);
    });
  });

  describe("a limit", () => {
    it("should bring the next document in after a delete", async () => {
      const first = await insert({age: 10, title: "a"});
      await insert({age: 20, title: "b"});
      await insert({age: 30, title: "c"});
      const chunks = await open({sort: {age: 1}, limit: 2});

      await remove(first);
      await until(() => chunks.live().some(chunk => chunk.kind == ChunkKind.Initial));

      expect(kinds(chunks.live())).toContain("Delete");
      expect(
        chunks
          .live()
          .filter(chunk => chunk.kind == ChunkKind.Initial)
          .map(chunk => chunk.document.title)
      ).toEqual(["c"]);
    });

    it("should stay quiet about an insert beyond the limit", async () => {
      await insert({age: 10, title: "a"});
      await insert({age: 20, title: "b"});
      const chunks = await open({sort: {age: 1}, limit: 2});

      await insert({age: 30, title: "c"});
      await sleep(SETTLE_MS);

      expect(chunks.live()).toEqual([]);
    });
  });

  describe("a sort", () => {
    it("should send the new order when a document moves", async () => {
      const first = await insert({age: 10, title: "a"});
      await insert({age: 20, title: "b"});
      const chunks = await open({sort: {age: 1}});

      await patch({...first, age: 30}, {age: 30});
      await until(() => kinds(chunks.live()).includes("Order"));

      expect(kinds(chunks.live())).toContain("Update");
      expect(kinds(chunks.live())).toContain("Order");
    });

    it("should send an order after an insert that sorts first", async () => {
      await insert({age: 20, title: "b"});
      const chunks = await open({sort: {age: 1}});

      await insert({age: 10, title: "a"});
      await until(() => kinds(chunks.live()).includes("Order"));

      expect(kinds(chunks.live())).toEqual(["Insert", "Order"]);
    });
  });
});
