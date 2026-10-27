import {Test, TestingModule} from "@nestjs/testing";
import {DuplicateKeyError, provideRepository} from "@spica-server/data";
import {contractSuite} from "@spica-server/database-testing";
import {ID_TYPES, IdType, IdTypes} from "@spica-server/interface-data";
import {
  FUNCTION_OPTIONS,
  FUNCTION_REPOSITORY,
  FunctionRepository
} from "@spica-server/interface-function";
import {
  FUNCTION_ASSET_REPOSITORY,
  FunctionAssetRepository
} from "@spica-server/interface-function-asset-storage";
import {
  FUNCTION_LOG_OPTIONS,
  FUNCTION_LOG_REPOSITORY,
  FUNCTION_LOG_SINK,
  LogRepository,
  LogSink
} from "@spica-server/interface-function-log";
import {
  WEBHOOK_LOG_REPOSITORY,
  WEBHOOK_OPTIONS,
  WEBHOOK_REPOSITORY,
  WebhookLogRepository,
  WebhookRepository
} from "@spica-server/interface-function-webhook";
import {clearStorage, waitForMongoIndexes} from "./support.js";

contractSuite("function repositories", engine => {
  let module: TestingModule;
  let idType: IdType;
  let functions: FunctionRepository;
  let logs: LogRepository;
  let logSink: LogSink;
  let webhooks: WebhookRepository;
  let webhookLogs: WebhookLogRepository;
  let assets: FunctionAssetRepository;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [engine.module()],
      providers: [
        {provide: FUNCTION_OPTIONS, useValue: {entryLimit: 4}},
        {provide: FUNCTION_LOG_OPTIONS, useValue: {expireAfterSeconds: 3600}},
        {provide: WEBHOOK_OPTIONS, useValue: {expireAfterSeconds: 3600}},
        provideRepository(FUNCTION_REPOSITORY),
        provideRepository(FUNCTION_LOG_REPOSITORY),
        provideRepository(FUNCTION_LOG_SINK),
        provideRepository(WEBHOOK_REPOSITORY),
        provideRepository(WEBHOOK_LOG_REPOSITORY),
        provideRepository(FUNCTION_ASSET_REPOSITORY)
      ]
    }).compile();
    await module.init();
    await waitForMongoIndexes(engine, module, {
      function: ["name_1"],
      function_assets: ["functionId_1_filename_1"]
    });

    idType = module.get<IdTypes>(ID_TYPES).unscoped();
    functions = module.get(FUNCTION_REPOSITORY);
    logs = module.get(FUNCTION_LOG_REPOSITORY);
    logSink = module.get(FUNCTION_LOG_SINK);
    webhooks = module.get(WEBHOOK_REPOSITORY);
    webhookLogs = module.get(WEBHOOK_LOG_REPOSITORY);
    assets = module.get(FUNCTION_ASSET_REPOSITORY);
  }, 120_000);

  beforeEach(() =>
    clearStorage(engine, module, {
      mongodb: ["function", "function_logs", "webhook", "webhook_logs", "function_assets"],
      postgresql: ["functions", "function_logs", "webhooks", "webhook_logs", "function_assets"]
    })
  );

  afterAll(() => module.close());

  const fn = (name: string, extra: object = {}) => ({
    name,
    timeout: 10,
    language: "javascript",
    triggers: {},
    ...extra
  });

  const missingId = () => idType.generate();

  describe("function", () => {
    it("inserts a function and finds it by id and name", async () => {
      const inserted = await functions.insert(
        fn("hello", {
          description: "d",
          triggers: {http: {type: "http", active: true, options: {path: "/a"}}}
        })
      );

      expect(inserted._id).toBeDefined();
      expect(await functions.findById(inserted._id)).toMatchObject({
        name: "hello",
        description: "d",
        timeout: 10,
        triggers: {http: {type: "http", active: true, options: {path: "/a"}}}
      });
      expect(String((await functions.findByName("hello"))._id)).toBe(String(inserted._id));
      expect(await functions.findByName("nope")).toBeNull();
      expect(await functions.findById(missingId())).toBeNull();
    });

    it("lists functions in creation order and summaries with only their identity", async () => {
      await functions.insert(fn("a", {description: "first"}));
      await functions.insert(fn("b"));

      expect((await functions.findAll()).map(f => f.name)).toEqual(["a", "b"]);
      const summaries = await functions.findSummaries();
      expect(summaries.map(s => Object.keys(s).sort())).toEqual([
        ["_id", "language", "name"],
        ["_id", "language", "name"]
      ]);
    });

    it("reports duplicate names as DuplicateKeyError", async () => {
      await functions.insert(fn("hello"));

      const inserted = await functions.insert(fn("hello")).catch(e => e);
      const {_id} = await functions.insert(fn("other"));
      const updated = await functions.updateById(_id, {name: "hello"}).catch(e => e);

      for (const error of [inserted, updated]) {
        expect(error).toBeInstanceOf(DuplicateKeyError);
        expect(error.keyValue).toEqual({name: "hello"});
      }
    });

    it("refuses inserts beyond the entry limit and reports its status", async () => {
      for (const name of ["a", "b", "c", "d"]) {
        await functions.insert(fn(name));
      }

      await expect(functions.insert(fn("e"))).rejects.toThrow(
        "Maximum number of documents has been reached"
      );
      expect(await functions.status()).toEqual({limit: 4, current: 4, unit: "count"});
    });

    it("sets fields and resolves to the function as it was before", async () => {
      const {_id} = await functions.insert(fn("hello", {description: "old"}));

      const before = await functions.updateById(_id, {description: "new", timeout: 20});

      expect(before).toMatchObject({description: "old", timeout: 10});
      expect(await functions.findById(_id)).toMatchObject({description: "new", timeout: 20});
      expect(await functions.updateById(missingId(), {timeout: 1})).toBeNull();
    });

    describe("merge patch", () => {
      const triggers = (active: boolean) => ({
        http: {type: "http", active, options: {path: "/a"}},
        cron: {type: "schedule", active: true, options: {frequency: "* * * * *"}}
      });

      it("applies the patched fields and keeps the others", async () => {
        const stored = await functions.insert(
          fn("hello", {description: "old", triggers: triggers(true)})
        );
        const patch = {description: "new", triggers: {http: {active: false}}};
        const patched = {...stored, description: "new", triggers: triggers(false)};

        const updated = await functions.applyMergePatch(stored._id, patch, patched);

        expect(updated).toMatchObject({name: "hello", description: "new", timeout: 10});
        expect(updated.triggers).toEqual(triggers(false));
      });

      it("removes the fields the patch sets to null", async () => {
        const stored = await functions.insert(
          fn("hello", {description: "old", triggers: triggers(true)})
        );
        const patched = {...stored, description: undefined, triggers: {http: triggers(true).http}};
        delete patched.description;

        const updated = await functions.applyMergePatch(
          stored._id,
          {description: null, triggers: {cron: null}},
          patched
        );

        expect(updated).not.toHaveProperty("description");
        expect(updated.triggers).toEqual({http: triggers(true).http});
      });

      it("resolves to undefined when the patch changes nothing and null for a missing function", async () => {
        const stored = await functions.insert(fn("hello"));

        expect(await functions.applyMergePatch(stored._id, {}, stored)).toBeUndefined();
        expect(
          await functions.applyMergePatch(missingId(), {timeout: 5}, {...stored, timeout: 5})
        ).toBeNull();
      });
    });

    it("replaces a function and counts the replacement", async () => {
      const {_id} = await functions.insert(fn("hello", {description: "old"}));

      expect(await functions.replaceById(_id, fn("renamed"))).toBe(1);

      const replaced = await functions.findById(_id);
      expect(replaced.name).toBe("renamed");
      expect(replaced).not.toHaveProperty("description");
      expect(await functions.replaceById(missingId(), fn("x"))).toBe(0);
    });

    it("deletes a function and resolves to it", async () => {
      const {_id} = await functions.insert(fn("hello"));

      expect(await functions.deleteById(_id)).toMatchObject({name: "hello"});
      expect(await functions.deleteById(_id)).toBeNull();
    });

    it("adds and removes env var and secret references, resolving to the function as it was", async () => {
      const {_id} = await functions.insert(fn("hello"));
      const [env1, env2, secret] = [missingId(), missingId(), missingId()];
      const idsOf = async (field: "env_vars" | "secrets") =>
        ((await functions.findById(_id))[field] || []).map(String);

      expect((await functions.addEnvVar(_id, env1)).env_vars || []).toEqual([]);
      await functions.addEnvVar(_id, env1);
      await functions.addEnvVar(_id, env2);
      await functions.addSecret(_id, secret);

      expect(await idsOf("env_vars")).toEqual([String(env1), String(env2)]);
      expect(await idsOf("secrets")).toEqual([String(secret)]);
      expect((await functions.removeEnvVar(_id, env1)).env_vars.map(String)).toEqual([
        String(env1),
        String(env2)
      ]);
      await functions.removeSecret(_id, secret);
      expect(await idsOf("env_vars")).toEqual([String(env2)]);
      expect(await idsOf("secrets")).toEqual([]);
      expect(await functions.addEnvVar(missingId(), env1)).toBeNull();
      expect(await functions.removeSecret(missingId(), secret)).toBeNull();
    });

    it("finds the functions that reference an env var or a secret", async () => {
      const a = await functions.insert(fn("a"));
      const b = await functions.insert(fn("b"));
      const env = missingId();
      const secret = missingId();
      await functions.addEnvVar(a._id, env);
      await functions.addEnvVar(b._id, env);
      await functions.addSecret(b._id, secret);

      expect((await functions.findReferencing("env_vars", env)).map(f => f.name)).toEqual([
        "a",
        "b"
      ]);
      expect((await functions.findReferencing("secrets", secret)).map(f => f.name)).toEqual(["b"]);
      expect(await functions.findReferencing("secrets", missingId())).toEqual([]);
    });
  });

  describe("function logs", () => {
    const log = (functionId: string, extra: object = {}) => ({
      function: functionId,
      event_id: "event",
      content: "hello",
      created_at: new Date("2024-01-02T00:00:00Z"),
      channel: "stdout" as any,
      level: 1 as any,
      ...extra
    });

    it("deletes the logs of a function and counts them", async () => {
      const a = String(missingId());
      const b = String(missingId());
      await logSink.insert(log(a));
      await logSink.insert(log(a));
      await logSink.insert(log(b));

      expect(await logs.deleteByFunction(a)).toBe(2);
      expect(await logs.deleteByFunction(a)).toBe(0);
      expect(await logs.deleteByFunction(b)).toBe(1);
    });

    it("deletes only the logs created in the range", async () => {
      const id = String(missingId());
      const hour = 60 * 60 * 1000;
      await logSink.insert(log(id, {created_at: new Date()}));
      await logSink.insert(log(id, {created_at: new Date()}));

      const past = await logs.deleteByFunction(id, {
        createdBetween: {from: new Date(Date.now() - 2 * hour), to: new Date(Date.now() - hour)}
      });
      const around = await logs.deleteByFunction(id, {
        createdBetween: {from: new Date(Date.now() - hour), to: new Date(Date.now() + hour)}
      });

      expect(past).toBe(0);
      expect(around).toBe(2);
    });

    it("deletes only the logs of the given levels", async () => {
      const id = String(missingId());
      await logSink.insert(log(id, {level: 0}));
      await logSink.insert(log(id, {level: 3}));
      await logSink.insert(log(id, {level: 4}));

      expect(await logs.deleteByFunction(id, {levels: [3, 4]})).toBe(2);
      expect(await logs.deleteByFunction(id, {levels: []})).toBe(1);
    });
  });

  describe("webhook", () => {
    const webhook = (title: string) => ({
      title,
      url: "https://example.com/hook",
      body: "{}",
      trigger: {
        name: "database" as const,
        active: true,
        options: {collection: "bucket_1", type: "INSERT" as const}
      }
    });

    it("inserts, finds and lists webhooks", async () => {
      const first = await webhooks.insert(webhook("a"));
      await webhooks.insert(webhook("b"));

      expect(await webhooks.findById(first._id)).toMatchObject(webhook("a"));
      expect((await webhooks.findAll()).map(w => w.title)).toEqual(["a", "b"]);
      expect(await webhooks.findById(missingId())).toBeNull();
    });

    it("replaces a webhook and resolves to the replaced one", async () => {
      const {_id} = await webhooks.insert(webhook("a"));

      const replaced = await webhooks.replaceById(_id, webhook("renamed"));

      expect(replaced).toMatchObject({title: "renamed"});
      expect((await webhooks.findById(_id)).title).toBe("renamed");
      expect(await webhooks.replaceById(missingId(), webhook("x"))).toBeNull();
    });

    it("deletes a webhook and resolves to it", async () => {
      const {_id} = await webhooks.insert(webhook("a"));

      expect(await webhooks.deleteById(_id)).toMatchObject({title: "a"});
      expect(await webhooks.deleteById(_id)).toBeNull();
    });
  });

  describe("webhook logs", () => {
    const webhookLog = () => ({
      webhook: String(missingId()),
      succeed: true,
      content: {request: {headers: {a: "b"}, url: "https://example.com", body: "{}"}},
      created_at: new Date("2024-01-02T00:00:00Z")
    });

    it("inserts logs and deletes them by id", async () => {
      const inserted = await webhookLogs.insert(webhookLog());

      expect(inserted._id).toBeDefined();
      expect(inserted).toMatchObject({succeed: true, content: {request: {headers: {a: "b"}}}});
      expect(await webhookLogs.deleteById(inserted._id)).toBe(1);
      expect(await webhookLogs.deleteById(inserted._id)).toBe(0);
    });

    it("deletes many logs by their ids", async () => {
      const [a, b, c] = [
        await webhookLogs.insert(webhookLog()),
        await webhookLogs.insert(webhookLog()),
        await webhookLogs.insert(webhookLog())
      ];

      expect(await webhookLogs.deleteByIds([a._id, b._id])).toBe(2);
      expect(await webhookLogs.deleteByIds([a._id, b._id, c._id])).toBe(1);
      expect(await webhookLogs.deleteByIds([])).toBe(0);
    });
  });

  describe("function assets", () => {
    const fields = (key: string) => ({
      key,
      hash: `hash-${key}`,
      size: 1234,
      uploadDate: new Date("2024-01-02T00:00:00Z"),
      strategy: "gridfs"
    });

    it("stores an asset once per function and filename", async () => {
      const functionId = missingId();

      await assets.upsertAsset(functionId, "index.mjs", fields("k1"));
      const first = await assets.findByFilename(functionId, "index.mjs");
      await assets.upsertAsset(functionId, "index.mjs", fields("k2"));
      const second = await assets.findByFilename(functionId, "index.mjs");

      expect(first).toMatchObject({
        filename: "index.mjs",
        key: "k1",
        size: 1234,
        strategy: "gridfs"
      });
      expect(String(second._id)).toBe(String(first._id));
      expect(second).toMatchObject({key: "k2", hash: "hash-k2"});
      expect(await assets.findByFilename(functionId, "index.ts")).toBeNull();
    });

    it("stores many assets and lists the ones of a function", async () => {
      const functionId = missingId();
      const other = missingId();
      await assets.upsertMany(functionId, [
        {filename: "index.ts", ...fields("a")},
        {filename: "package.json", ...fields("b")}
      ]);
      await assets.upsertAsset(other, "index.ts", fields("c"));

      const stored = await assets.findByFunction(functionId);

      expect(stored.map(a => a.filename).sort()).toEqual(["index.ts", "package.json"]);
      expect(stored.every(a => String(a.functionId) == String(functionId))).toBe(true);
    });

    it("moves the key only while it still is the expected one", async () => {
      const functionId = missingId();
      await assets.upsertAsset(functionId, "index.ts", fields("k1"));

      expect(await assets.replaceKey(functionId, "index.ts", "k1", "k2")).toBe(true);
      expect(await assets.replaceKey(functionId, "index.ts", "k1", "k3")).toBe(false);
      expect((await assets.findByFilename(functionId, "index.ts")).key).toBe("k2");
    });

    it("deletes the assets of a function", async () => {
      const functionId = missingId();
      const other = missingId();
      await assets.upsertMany(functionId, [
        {filename: "index.ts", ...fields("a")},
        {filename: "index.mjs", ...fields("b")}
      ]);
      await assets.upsertAsset(other, "index.ts", fields("c"));

      expect(await assets.deleteByFunction(functionId)).toBe(2);
      expect(await assets.findByFunction(functionId)).toEqual([]);
      expect(await assets.findByFunction(other)).toHaveLength(1);
    });
  });
});
