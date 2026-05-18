import os from "os";
import path from "path";
import fs from "fs";
import yaml from "yaml";
import {createDevDispatcher, DevState} from "@spica/cli/src/commands/sync/dev";
import {ResourceModule, LocalResource, RemoteResource} from "@spica/cli/src/commands/sync/types";
import {functionModule} from "@spica/cli/src/commands/sync/modules/function";

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "spica-dev-test-"));
}

function cleanup(dir: string) {
  fs.rmSync(dir, {recursive: true, force: true});
}

function makeState(entries: Record<string, Record<string, string>> = {}): DevState {
  const remoteIds = new Map<string, Map<string, string>>();
  for (const [mod, slugs] of Object.entries(entries)) {
    remoteIds.set(mod, new Map(Object.entries(slugs)));
  }
  return {remoteIds};
}

function makeMockModule(
  name: string,
  overrides: Partial<ResourceModule> = {}
): ResourceModule & {
  create: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  readRemote: jest.Mock;
} {
  return {
    name,
    displayName: name,
    identityField: "name",
    ignoredFields: ["_id"],
    readLocal: jest.fn().mockResolvedValue([]),
    readRemote: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    writeLocal: jest.fn().mockResolvedValue(undefined),
    deleteLocal: jest.fn().mockResolvedValue(undefined),
    diffFields: () => [],
    renderDetail: () => ({}),
    summaryLine: (r: any) => String(r.slug),
    extractLocalId: (data: any) => data._id,
    ...overrides
  } as any;
}

/** Build a function module mock: real devHandleEvent + watchedFiles, mocked CRUD */
function makeFunctionMod() {
  return {
    ...functionModule,
    readRemote: jest.fn<Promise<any[]>, []>().mockResolvedValue([]),
    // legacy composite methods
    create: jest.fn<Promise<void>, any[]>().mockResolvedValue(undefined),
    update: jest.fn<Promise<void>, any[]>().mockResolvedValue(undefined),
    delete: jest.fn<Promise<void>, any[]>().mockResolvedValue(undefined),
    // granular write methods used by devHandleEvent
    createSchema: jest.fn<Promise<string | undefined>, any[]>().mockResolvedValue("remote-fn-id"),
    updateSchema: jest.fn<Promise<void>, any[]>().mockResolvedValue(undefined),
    uploadIndex: jest.fn<Promise<void>, any[]>().mockResolvedValue(undefined),
    uploadDependencies: jest.fn<Promise<void>, any[]>().mockResolvedValue(undefined)
  };
}

const mockHttp = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn()
} as any;

beforeEach(() => jest.clearAllMocks());

// ─── Dispatcher: bucket (schema-only module) ──────────────────────────────────

describe("DevDispatcher — bucket: add (create)", () => {
  it("calls mod.create when schema.yaml is added and no remote exists", async () => {
    const dir = makeTmpDir();
    try {
      const bucketDir = path.join(dir, "bucket", "my-bucket");
      fs.mkdirSync(bucketDir, {recursive: true});
      fs.writeFileSync(
        path.join(bucketDir, "schema.yaml"),
        yaml.stringify({title: "My Bucket", properties: {}})
      );

      const mod = makeMockModule("bucket");
      const state = makeState(); // no existing remote ids
      const logs: string[] = [];
      const dispatcher = createDevDispatcher({
        modules: [mod],
        http: mockHttp,
        rootDir: dir,
        state,
        logger: m => logs.push(m),
        warnLogger: m => logs.push(m)
      });

      await dispatcher.handleEvent("add", path.join(dir, "bucket", "my-bucket", "schema.yaml"));

      expect(mod.create).toHaveBeenCalledTimes(1);
      expect(mod.update).not.toHaveBeenCalled();
      expect(mod.delete).not.toHaveBeenCalled();
      const [, local] = mod.create.mock.calls[0];
      expect(local.slug).toBe("my-bucket");
      expect(local.data.title).toBe("My Bucket");
    } finally {
      cleanup(dir);
    }
  });
});

describe("DevDispatcher — bucket: change (update)", () => {
  it("calls mod.update with stored remoteId when schema.yaml changes", async () => {
    const dir = makeTmpDir();
    try {
      const bucketDir = path.join(dir, "bucket", "my-bucket");
      fs.mkdirSync(bucketDir, {recursive: true});
      fs.writeFileSync(
        path.join(bucketDir, "schema.yaml"),
        yaml.stringify({_id: "id-1", title: "Updated Bucket", properties: {}})
      );

      const mod = makeMockModule("bucket");
      const state = makeState({bucket: {"my-bucket": "id-1"}});
      const logs: string[] = [];
      const dispatcher = createDevDispatcher({
        modules: [mod],
        http: mockHttp,
        rootDir: dir,
        state,
        logger: m => logs.push(m)
      });

      await dispatcher.handleEvent("change", path.join(dir, "bucket", "my-bucket", "schema.yaml"));

      expect(mod.update).toHaveBeenCalledTimes(1);
      expect(mod.create).not.toHaveBeenCalled();
      const [, local, remoteId] = mod.update.mock.calls[0];
      expect(local.slug).toBe("my-bucket");
      expect(remoteId).toBe("id-1");
    } finally {
      cleanup(dir);
    }
  });
});

describe("DevDispatcher — bucket: unlink (delete)", () => {
  it("calls mod.delete after rename window when schema.yaml is removed", async () => {
    jest.useFakeTimers();
    const dir = makeTmpDir();
    try {
      const mod = makeMockModule("bucket");
      const state = makeState({bucket: {"my-bucket": "id-1"}});
      const logs: string[] = [];
      const dispatcher = createDevDispatcher({
        modules: [mod],
        http: mockHttp,
        rootDir: dir,
        state,
        logger: m => logs.push(m),
        renameWindowMs: 200
      });

      const eventPromise = dispatcher.handleEvent(
        "unlink",
        path.join(dir, "bucket", "my-bucket", "schema.yaml")
      );
      await eventPromise;

      // Before timer fires, delete should not have been called
      expect(mod.delete).not.toHaveBeenCalled();

      // Advance time past the rename window
      await jest.runAllTimersAsync();

      expect(mod.delete).toHaveBeenCalledTimes(1);
      expect(mod.delete.mock.calls[0][1]).toBe("id-1");
    } finally {
      jest.useRealTimers();
      cleanup(dir);
    }
  });

  it("does NOT call delete when slug has no known remoteId", async () => {
    jest.useFakeTimers();
    const dir = makeTmpDir();
    try {
      const mod = makeMockModule("bucket");
      const state = makeState(); // empty
      const dispatcher = createDevDispatcher({
        modules: [mod],
        http: mockHttp,
        rootDir: dir,
        state,
        renameWindowMs: 200
      });

      await dispatcher.handleEvent(
        "unlink",
        path.join(dir, "bucket", "unknown-bucket", "schema.yaml")
      );
      await jest.runAllTimersAsync();

      expect(mod.delete).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
      cleanup(dir);
    }
  });
});

// ─── Dispatcher: rename detection ─────────────────────────────────────────────

describe("DevDispatcher — rename detection (single update, no delete+create)", () => {
  it("promotes rename to a single update when _id matches pending delete", async () => {
    jest.useFakeTimers();
    const dir = makeTmpDir();
    try {
      // Create the new-name folder on disk
      const newDir = path.join(dir, "bucket", "new-name");
      fs.mkdirSync(newDir, {recursive: true});
      fs.writeFileSync(
        path.join(newDir, "schema.yaml"),
        yaml.stringify({_id: "id-1", title: "New Name", properties: {}})
      );

      const mod = makeMockModule("bucket");
      const state = makeState({bucket: {"old-name": "id-1"}});
      const logs: string[] = [];
      const dispatcher = createDevDispatcher({
        modules: [mod],
        http: mockHttp,
        rootDir: dir,
        state,
        logger: m => logs.push(m),
        renameWindowMs: 500
      });

      // Simulate: unlink old-name, then add new-name within the window
      const unlinkPromise = dispatcher.handleEvent(
        "unlink",
        path.join(dir, "bucket", "old-name", "schema.yaml")
      );
      await unlinkPromise;

      // The add comes before the rename window expires
      const addPromise = dispatcher.handleEvent(
        "add",
        path.join(dir, "bucket", "new-name", "schema.yaml")
      );
      await addPromise;

      // No timers needed — update should already have been called during add handling
      expect(mod.delete).not.toHaveBeenCalled();
      expect(mod.create).not.toHaveBeenCalled();
      expect(mod.update).toHaveBeenCalledTimes(1);
      const [, local, remoteId] = mod.update.mock.calls[0];
      expect(local.slug).toBe("new-name");
      expect(remoteId).toBe("id-1");

      // Advance timers to confirm no delayed delete fires
      await jest.runAllTimersAsync();
      expect(mod.delete).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
      cleanup(dir);
    }
  });
});

// ─── Dispatcher: function create via schema.yaml add ────────────────────────

describe("DevDispatcher — function: schema.yaml add creates function", () => {
  it("calls createSchema only — index and deps upload via their own add events", async () => {
    const dir = makeTmpDir();
    try {
      const fnDir = path.join(dir, "function", "MyFn");
      fs.mkdirSync(fnDir, {recursive: true});
      fs.writeFileSync(
        path.join(fnDir, "schema.yaml"),
        yaml.stringify({name: "MyFn", language: "javascript"})
      );

      const mod = makeFunctionMod();
      const state = makeState(); // no existing function

      const dispatcher = createDevDispatcher({
        modules: [mod],
        http: mockHttp,
        rootDir: dir,
        state
      });

      await dispatcher.handleEvent("add", path.join(dir, "function", "MyFn", "schema.yaml"));

      expect(mod.createSchema).toHaveBeenCalledTimes(1);
      // index and deps are NOT uploaded by schema add — their own events handle them
      expect(mod.uploadIndex).not.toHaveBeenCalled();
      expect(mod.uploadDependencies).not.toHaveBeenCalled();
      expect(mod.create).not.toHaveBeenCalled();
      expect(mod.delete).not.toHaveBeenCalled();
    } finally {
      cleanup(dir);
    }
  });

  it("add on index.mjs calls uploadIndex (remoteId already available)", async () => {
    const dir = makeTmpDir();
    try {
      const fnDir = path.join(dir, "function", "MyFn");
      fs.mkdirSync(fnDir, {recursive: true});
      fs.writeFileSync(
        path.join(fnDir, "schema.yaml"),
        yaml.stringify({name: "MyFn", language: "javascript"})
      );
      fs.writeFileSync(path.join(fnDir, "index.mjs"), "export default () => {};");

      const mod = makeFunctionMod();
      const state = makeState({function: {MyFn: "remote-fn-id"}});

      const dispatcher = createDevDispatcher({
        modules: [mod],
        http: mockHttp,
        rootDir: dir,
        state
      });

      await dispatcher.handleEvent("add", path.join(dir, "function", "MyFn", "index.mjs"));

      expect(mod.uploadIndex).toHaveBeenCalledTimes(1);
      const [, remoteId] = mod.uploadIndex.mock.calls[0];
      expect(remoteId).toBe("remote-fn-id");
      expect(mod.uploadDependencies).not.toHaveBeenCalled();
      expect(mod.createSchema).not.toHaveBeenCalled();
    } finally {
      cleanup(dir);
    }
  });

  it("add on package.json calls uploadDependencies (remoteId already available)", async () => {
    const dir = makeTmpDir();
    try {
      const fnDir = path.join(dir, "function", "MyFn");
      fs.mkdirSync(fnDir, {recursive: true});
      fs.writeFileSync(
        path.join(fnDir, "schema.yaml"),
        yaml.stringify({name: "MyFn", language: "javascript"})
      );
      fs.writeFileSync(
        path.join(fnDir, "package.json"),
        JSON.stringify({dependencies: {lodash: "^4.0.0"}})
      );

      const mod = makeFunctionMod();
      const state = makeState({function: {MyFn: "remote-fn-id"}});

      const dispatcher = createDevDispatcher({
        modules: [mod],
        http: mockHttp,
        rootDir: dir,
        state
      });

      await dispatcher.handleEvent("add", path.join(dir, "function", "MyFn", "package.json"));

      expect(mod.uploadDependencies).toHaveBeenCalledTimes(1);
      const [, remoteId, deps] = mod.uploadDependencies.mock.calls[0];
      expect(remoteId).toBe("remote-fn-id");
      expect(deps).toEqual({lodash: "^4.0.0"});
      expect(mod.uploadIndex).not.toHaveBeenCalled();
    } finally {
      cleanup(dir);
    }
  });
});

// ─── Dispatcher: function schema change (update) ─────────────────────────────

describe("DevDispatcher — function: schema.yaml change updates schema only", () => {
  it("calls updateSchema only — no index or deps upload", async () => {
    const dir = makeTmpDir();
    try {
      const fnDir = path.join(dir, "function", "MyFn");
      fs.mkdirSync(fnDir, {recursive: true});
      fs.writeFileSync(
        path.join(fnDir, "schema.yaml"),
        yaml.stringify({name: "MyFn", language: "javascript", timeout: 60})
      );

      const mod = makeFunctionMod();
      const state = makeState({function: {MyFn: "remote-fn-id"}});

      const dispatcher = createDevDispatcher({
        modules: [mod],
        http: mockHttp,
        rootDir: dir,
        state
      });

      await dispatcher.handleEvent("change", path.join(dir, "function", "MyFn", "schema.yaml"));

      expect(mod.updateSchema).toHaveBeenCalledTimes(1);
      const [, remoteId, schema] = mod.updateSchema.mock.calls[0];
      expect(remoteId).toBe("remote-fn-id");
      expect(schema.timeout).toBe(60);
      expect(mod.uploadIndex).not.toHaveBeenCalled();
      expect(mod.uploadDependencies).not.toHaveBeenCalled();
      expect(mod.create).not.toHaveBeenCalled();
      expect(mod.update).not.toHaveBeenCalled();
    } finally {
      cleanup(dir);
    }
  });
});

// ─── Dispatcher: function unlink of index/package is silently ignored ────────

describe("DevDispatcher — function: unlink of index/package is silently ignored", () => {
  it("does nothing when index.mjs is removed (could be a rename)", async () => {
    const dir = makeTmpDir();
    try {
      const fnDir = path.join(dir, "function", "MyFn");
      fs.mkdirSync(fnDir, {recursive: true});
      fs.writeFileSync(
        path.join(fnDir, "schema.yaml"),
        yaml.stringify({name: "MyFn", language: "javascript"})
      );

      const mod = makeFunctionMod();
      const state = makeState({function: {MyFn: "remote-id-1"}});
      const warns: string[] = [];

      const dispatcher = createDevDispatcher({
        modules: [mod],
        http: mockHttp,
        rootDir: dir,
        state,
        warnLogger: m => warns.push(m)
      });

      await dispatcher.handleEvent(
        "unlink",
        path.join(dir, "function", "MyFn", "index.mjs")
      );

      expect(mod.delete).not.toHaveBeenCalled();
      expect(mod.update).not.toHaveBeenCalled();
      expect(mod.create).not.toHaveBeenCalled();
      expect(warns).toHaveLength(0);
    } finally {
      cleanup(dir);
    }
  });

  it("does nothing when package.json is removed (could be a rename)", async () => {
    const dir = makeTmpDir();
    try {
      const fnDir = path.join(dir, "function", "MyFn");
      fs.mkdirSync(fnDir, {recursive: true});
      fs.writeFileSync(
        path.join(fnDir, "schema.yaml"),
        yaml.stringify({name: "MyFn", language: "javascript"})
      );

      const mod2 = makeFunctionMod();
      const state2 = makeState({function: {MyFn: "remote-id-1"}});
      const warns2: string[] = [];

      const dispatcher2 = createDevDispatcher({
        modules: [mod2],
        http: mockHttp,
        rootDir: dir,
        state: state2,
        warnLogger: m => warns2.push(m)
      });

      await dispatcher2.handleEvent(
        "unlink",
        path.join(dir, "function", "MyFn", "package.json")
      );

      expect(mod2.delete).not.toHaveBeenCalled();
      expect(warns2).toHaveLength(0);
    } finally {
      cleanup(dir);
    }
  });
});

// ─── Dispatcher: function delete via schema unlink ────────────────────────────

describe("DevDispatcher — function: schema.yaml unlink deletes remote", () => {
  it("calls functionModule.delete after rename window", async () => {
    jest.useFakeTimers();
    const dir = makeTmpDir();
    try {
      const mod = makeFunctionMod();
      const state = makeState({function: {MyFn: "remote-fn-id"}});
      const logs: string[] = [];

      const dispatcher = createDevDispatcher({
        modules: [mod],
        http: mockHttp,
        rootDir: dir,
        state,
        logger: m => logs.push(m),
        renameWindowMs: 200
      });

      const eventPromise = dispatcher.handleEvent(
        "unlink",
        path.join(dir, "function", "MyFn", "schema.yaml")
      );
      await eventPromise;

      expect(mod.delete).not.toHaveBeenCalled();
      await jest.runAllTimersAsync();
      expect(mod.delete).toHaveBeenCalledTimes(1);
      expect(mod.delete.mock.calls[0][1]).toBe("remote-fn-id");
    } finally {
      jest.useRealTimers();
      cleanup(dir);
    }
  });
});

// ─── Dispatcher: function update on index/package change ─────────────────────

describe("DevDispatcher — function: index/package change triggers granular update", () => {
  it("calls uploadIndex (not update) when index.mjs changes", async () => {
    const dir = makeTmpDir();
    try {
      const fnDir = path.join(dir, "function", "MyFn");
      fs.mkdirSync(fnDir, {recursive: true});
      fs.writeFileSync(
        path.join(fnDir, "schema.yaml"),
        yaml.stringify({name: "MyFn", language: "javascript"})
      );
      fs.writeFileSync(path.join(fnDir, "index.mjs"), "export default () => 42;");

      const mod = makeFunctionMod();
      const state = makeState({function: {MyFn: "remote-fn-id"}});

      const dispatcher = createDevDispatcher({
        modules: [mod],
        http: mockHttp,
        rootDir: dir,
        state
      });

      await dispatcher.handleEvent("change", path.join(dir, "function", "MyFn", "index.mjs"));

      expect(mod.uploadIndex).toHaveBeenCalledTimes(1);
      const [, remoteId, index] = mod.uploadIndex.mock.calls[0];
      expect(remoteId).toBe("remote-fn-id");
      expect(index).toBe("export default () => 42;");
      expect(mod.update).not.toHaveBeenCalled();
      expect(mod.updateSchema).not.toHaveBeenCalled();
      expect(mod.uploadDependencies).not.toHaveBeenCalled();
    } finally {
      cleanup(dir);
    }
  });

  it("calls uploadDependencies (not update) when package.json changes", async () => {
    const dir = makeTmpDir();
    try {
      const fnDir = path.join(dir, "function", "MyFn");
      fs.mkdirSync(fnDir, {recursive: true});
      fs.writeFileSync(
        path.join(fnDir, "schema.yaml"),
        yaml.stringify({name: "MyFn", language: "javascript"})
      );
      fs.writeFileSync(
        path.join(fnDir, "package.json"),
        JSON.stringify({dependencies: {lodash: "^4.0.0"}})
      );

      const mod = makeFunctionMod();
      const state = makeState({function: {MyFn: "remote-fn-id"}});

      const dispatcher = createDevDispatcher({
        modules: [mod],
        http: mockHttp,
        rootDir: dir,
        state
      });

      await dispatcher.handleEvent("change", path.join(dir, "function", "MyFn", "package.json"));

      expect(mod.uploadDependencies).toHaveBeenCalledTimes(1);
      const [, remoteId, deps] = mod.uploadDependencies.mock.calls[0];
      expect(remoteId).toBe("remote-fn-id");
      expect(deps).toEqual({lodash: "^4.0.0"});
      expect(mod.update).not.toHaveBeenCalled();
      expect(mod.updateSchema).not.toHaveBeenCalled();
      expect(mod.uploadIndex).not.toHaveBeenCalled();
    } finally {
      cleanup(dir);
    }
  });
});

// ─── Dispatcher: function rename detection ────────────────────────────────────

describe("DevDispatcher — function rename: promoted to single update", () => {
  it("does not delete+create when _id matches pending delete", async () => {
    jest.useFakeTimers();
    const dir = makeTmpDir();
    try {
      const newFnDir = path.join(dir, "function", "new-fn-name");
      fs.mkdirSync(newFnDir, {recursive: true});
      fs.writeFileSync(
        path.join(newFnDir, "schema.yaml"),
        yaml.stringify({_id: "fn-id-1", name: "new-fn-name", language: "javascript"})
      );
      fs.writeFileSync(path.join(newFnDir, "index.mjs"), "export default () => {};");
      fs.writeFileSync(path.join(newFnDir, "package.json"), JSON.stringify({dependencies: {}}));

      const mod = makeFunctionMod();
      const state = makeState({function: {"old-fn-name": "fn-id-1"}});

      const dispatcher = createDevDispatcher({
        modules: [mod],
        http: mockHttp,
        rootDir: dir,
        state,
        renameWindowMs: 500
      });

      await dispatcher.handleEvent(
        "unlink",
        path.join(dir, "function", "old-fn-name", "schema.yaml")
      );
      await dispatcher.handleEvent(
        "add",
        path.join(dir, "function", "new-fn-name", "schema.yaml")
      );

      expect(mod.delete).not.toHaveBeenCalled();
      expect(mod.create).not.toHaveBeenCalled();
      // Rename: schema handler calls updateSchema only
      // index and package.json add events will upload those separately
      expect(mod.updateSchema).toHaveBeenCalledTimes(1);
      expect(mod.uploadIndex).not.toHaveBeenCalled();
      expect(mod.uploadDependencies).not.toHaveBeenCalled();
      const [, remoteId] = mod.updateSchema.mock.calls[0];
      expect(remoteId).toBe("fn-id-1");

      await jest.runAllTimersAsync();
      expect(mod.delete).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
      cleanup(dir);
    }
  });
});

// ─── Dispatcher: dispose cancels pending timers ───────────────────────────────

describe("DevDispatcher — dispose cancels pending timers", () => {
  it("cancels pending deletes on dispose so delete is never called", async () => {
    jest.useFakeTimers();
    const dir = makeTmpDir();
    try {
      const mod = makeMockModule("bucket");
      const state = makeState({bucket: {"my-bucket": "id-1"}});

      const dispatcher = createDevDispatcher({
        modules: [mod],
        http: mockHttp,
        rootDir: dir,
        state,
        renameWindowMs: 500
      });

      await dispatcher.handleEvent(
        "unlink",
        path.join(dir, "bucket", "my-bucket", "schema.yaml")
      );

      // Dispose before timer fires
      dispatcher.dispose();

      await jest.runAllTimersAsync();

      expect(mod.delete).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
      cleanup(dir);
    }
  });
});

// ─── Dispatcher: non-schema files are ignored for schema-only modules ─────────

describe("DevDispatcher — ignores non-schema files for non-function modules", () => {
  it("does nothing when a non-schema file changes in a bucket folder", async () => {
    const dir = makeTmpDir();
    try {
      const mod = makeMockModule("bucket");
      const state = makeState({bucket: {"my-bucket": "id-1"}});

      const dispatcher = createDevDispatcher({
        modules: [mod],
        http: mockHttp,
        rootDir: dir,
        state
      });

      await dispatcher.handleEvent(
        "change",
        path.join(dir, "bucket", "my-bucket", "some-other.txt")
      );

      expect(mod.create).not.toHaveBeenCalled();
      expect(mod.update).not.toHaveBeenCalled();
      expect(mod.delete).not.toHaveBeenCalled();
    } finally {
      cleanup(dir);
    }
  });
});

// ─── Dispatcher: function code add waits for remoteId ────────────────────────────

describe("DevDispatcher — function: code file arrives before schema is deployed", () => {
  it("waits for remoteId then uploads index.ts once schema handler populates it", async () => {
    jest.useFakeTimers();
    const dir = makeTmpDir();
    try {
      const fnDir = path.join(dir, "function", "MyFn");
      fs.mkdirSync(fnDir, {recursive: true});
      fs.writeFileSync(path.join(fnDir, "index.ts"), "export default {}");
      fs.writeFileSync(
        path.join(fnDir, "schema.yaml"),
        yaml.stringify({name: "MyFn", language: "typescript"})
      );

      const mod = makeFunctionMod();
      // Start with no remoteId — schema.yaml add has not been processed yet
      const state = makeState();

      const dispatcher = createDevDispatcher({
        modules: [mod],
        http: mockHttp,
        rootDir: dir,
        state
      });

      // Fire index.ts "add" first — no remoteId yet, will block in waitForRemoteId
      const codeEventPromise = dispatcher.handleEvent(
        "add",
        path.join(dir, "function", "MyFn", "index.ts")
      );

      // Simulate schema being deployed: remoteId appears in state
      state.remoteIds.set("function", new Map([["MyFn", "remote-fn-id"]]));

      // Advance timers so waitForRemoteId (10 × 200ms) polls and finds the id
      await jest.advanceTimersByTimeAsync(10 * 200);
      await codeEventPromise;

      expect(mod.uploadIndex).toHaveBeenCalledTimes(1);
      const [, remoteId] = mod.uploadIndex.mock.calls[0];
      expect(remoteId).toBe("remote-fn-id");
      expect(mod.uploadDependencies).not.toHaveBeenCalled();
      expect(mod.create).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
      cleanup(dir);
    }
  });

  it("silently skips when schema is never deployed within the wait window", async () => {
    jest.useFakeTimers();
    const dir = makeTmpDir();
    try {
      const fnDir = path.join(dir, "function", "MyFn");
      fs.mkdirSync(fnDir, {recursive: true});
      fs.writeFileSync(path.join(fnDir, "index.ts"), "export default {}");

      const mod = makeFunctionMod();
      const state = makeState(); // remoteId never appears

      const dispatcher = createDevDispatcher({
        modules: [mod],
        http: mockHttp,
        rootDir: dir,
        state
      });

      const codeEventPromise = dispatcher.handleEvent(
        "add",
        path.join(dir, "function", "MyFn", "index.ts")
      );

      await jest.advanceTimersByTimeAsync(10 * 200 + 100);
      await codeEventPromise;

      expect(mod.uploadIndex).not.toHaveBeenCalled();
      expect(mod.create).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
      cleanup(dir);
    }
  });
});
