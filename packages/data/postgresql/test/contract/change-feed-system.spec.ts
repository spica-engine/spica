import {Test, TestingModule} from "@nestjs/testing";
import {provideRepository} from "@spica-server/data";
import {contractSuite} from "@spica-server/database-testing";
import {
  FUNCTION_ASSET_COLLECTION,
  FUNCTION_ASSET_REPOSITORY,
  FunctionAssetRepository
} from "@spica-server/interface-function-asset-storage";
import {
  CHANGE_FEED,
  ChangeEvent,
  ChangeFeed,
  ChangeFeedOptions,
  ID_TYPES,
  IdType,
  IdTypes
} from "@spica-server/interface-data";
import {
  COMMAND_COLLECTION,
  COMMAND_REPOSITORY,
  CommandRepository,
  REPLICATION_SERVICE_OPTIONS
} from "@spica-server/interface-replication";

const SETTLE_MS = 600;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

contractSuite("change feed of system collections", engine => {
  let module: TestingModule;
  let feed: ChangeFeed & {ready?: () => Promise<void>};
  let assets: FunctionAssetRepository;
  let commands: CommandRepository;
  let ids: IdType;
  const subscriptions: {unsubscribe(): void}[] = [];

  async function listen(collection: string, options?: ChangeFeedOptions) {
    const events: ChangeEvent[] = [];
    subscriptions.push(feed.watch(collection, options).subscribe(event => events.push(event)));
    await feed.ready?.();
    await sleep(SETTLE_MS);
    return events;
  }

  async function eventually(events: ChangeEvent[], count: number) {
    for (let waited = 0; waited < 10_000 && events.length < count; waited += 50) {
      await sleep(50);
    }
    await sleep(SETTLE_MS);
    return events;
  }

  const asset = (key: string, hash: string) => ({
    key,
    hash,
    size: 10,
    uploadDate: new Date(),
    strategy: "default"
  });

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [engine.module()],
      providers: [
        {provide: REPLICATION_SERVICE_OPTIONS, useValue: {expireAfterSeconds: 60}},
        provideRepository(FUNCTION_ASSET_REPOSITORY),
        provideRepository(COMMAND_REPOSITORY)
      ]
    }).compile();
    await module.init();
    feed = module.get(CHANGE_FEED);
    assets = module.get(FUNCTION_ASSET_REPOSITORY);
    commands = module.get(COMMAND_REPOSITORY);
    ids = module.get<IdTypes>(ID_TYPES).unscoped();
  }, 120_000);

  afterAll(() => module.close());

  afterEach(() => subscriptions.splice(0).forEach(subscription => subscription.unsubscribe()));

  describe("function assets", () => {
    const options: ChangeFeedOptions = {document: "current", beforeChange: "whenAvailable"};

    it("should emit an insert with the asset", async () => {
      const events = await listen(FUNCTION_ASSET_COLLECTION, options);
      const functionId = ids.generate();

      await assets.upsertAsset(functionId, "index.ts", asset("functions/a/index.ts", "h1"));
      await eventually(events, 1);

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        operation: "insert",
        collection: FUNCTION_ASSET_COLLECTION,
        document: {filename: "index.ts", key: "functions/a/index.ts", hash: "h1"}
      });
      expect(String(events[0].document.functionId)).toEqual(String(functionId));
    });

    it("should emit an update with the asset as it is now", async () => {
      const functionId = ids.generate();
      await assets.upsertAsset(functionId, "index.ts", asset("functions/b/index.ts", "h1"));
      const events = await listen(FUNCTION_ASSET_COLLECTION, {...options, operations: ["update"]});

      await assets.upsertAsset(functionId, "index.ts", asset("functions/b/index.ts", "h2"));
      await eventually(events, 1);

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        operation: "update",
        document: {hash: "h2"},
        changes: {updated: {hash: "h2"}}
      });
    });

    it("should emit a delete with the asset as it was", async () => {
      const functionId = ids.generate();
      await assets.upsertAsset(functionId, "index.ts", asset("functions/c/index.ts", "h1"));
      const events = await listen(FUNCTION_ASSET_COLLECTION, {...options, operations: ["delete"]});

      await assets.deleteByFunction(functionId);
      await eventually(events, 1);

      expect(events).toHaveLength(1);
      expect(events[0].operation).toEqual("delete");
      expect(events[0].previousDocument).toMatchObject({key: "functions/c/index.ts"});
    });
  });

  describe("commands", () => {
    it("should emit an inserted command with its document", async () => {
      const events = await listen(COMMAND_COLLECTION, {operations: ["insert"]});
      const command = {handler: "doSomething", class: "Class1", args: []};

      await commands.insert({
        source: {id: "replica1", command},
        target: {id: "replica2", commands: [command]}
      } as any);
      await eventually(events, 1);

      expect(events).toHaveLength(1);
      expect(events[0].document).toMatchObject({
        source: {id: "replica1", command},
        target: {id: "replica2", commands: [command]}
      });
    });
  });
});
