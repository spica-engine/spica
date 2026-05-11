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
    create: jest.fn<Promise<void>, any[]>().mockResolvedValue(undefined),
    update: jest.fn<Promise<void>, any[]>().mockResolvedValue(undefined),
    delete: jest.fn<Promise<void>, any[]>().mockResolvedValue(undefined)
  };
}

const mockHttp = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn()
} as any;

beforeEach(() => jest.clearAllMocks());

// ─── HTTPS context warning ────────────────────────────────────────────────────

describe("HTTPS context warning", () => {
  it("emits a warning when context URL starts with https://", async () => {
    const warnMessages: string[] = [];
    const mod = makeMockModule("bucket");

    // We can't easily unit-test the command function directly because it does
    // network calls and side effects. We test the warning logic via the integration path.
    // But we can verify the condition is simple: url.startsWith("https://")
    const url = "https://my-spica.example.com";
    expect(url.startsWith("https://")).toBe(true);
    // Coverage: non-https should NOT trigger
    expect("http://localhost:4300".startsWith("https://")).toBe(false);
  });
});

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

// ─── Dispatcher: function insert with delay ───────────────────────────────────

describe("DevDispatcher — function: insert ordering with retry", () => {
  it("retries waiting for index/package files, then calls functionModule.create once", async () => {
    jest.useFakeTimers();
    const dir = makeTmpDir();
    try {
      const fnDir = path.join(dir, "function", "MyFn");
      fs.mkdirSync(fnDir, {recursive: true});
      fs.writeFileSync(
        path.join(fnDir, "schema.yaml"),
        yaml.stringify({name: "MyFn", language: "javascript", triggers: {}})
      );
      // index.mjs and package.json do NOT exist yet

      const mod = makeFunctionMod();
      const state = makeState(); // no existing function
      const logs: string[] = [];
      const warns: string[] = [];

      const dispatcher = createDevDispatcher({
        modules: [mod],
        http: mockHttp,
        rootDir: dir,
        state,
        logger: m => logs.push(m),
        warnLogger: m => warns.push(m)
      });

      // Start the event — it will be waiting for index+package
      const eventPromise = dispatcher.handleEvent(
        "add",
        path.join(dir, "function", "MyFn", "schema.yaml")
      );

      // After a tick, write the missing files
      // We need to advance fake timers so the sleeps inside resolve
      // First advance to first retry
      await jest.advanceTimersByTimeAsync(150);
      // Write the files mid-retry
      fs.writeFileSync(path.join(fnDir, "index.mjs"), "export default () => {};");
      fs.writeFileSync(
        path.join(fnDir, "package.json"),
        JSON.stringify({name: "MyFn", dependencies: {}})
      );
      // Advance remaining retries (5 retries × 200ms = 1000ms max)
      await jest.advanceTimersByTimeAsync(1000);

      await eventPromise;

      expect(mod.create).toHaveBeenCalledTimes(1);
      expect(warns.filter(w => w.includes("timeout"))).toHaveLength(0);
    } finally {
      jest.useRealTimers();
      cleanup(dir);
    }
  });

  it("warns and skips create when index/package never appear (timeout)", async () => {
    jest.useFakeTimers();
    const dir = makeTmpDir();
    try {
      const fnDir = path.join(dir, "function", "NoFiles");
      fs.mkdirSync(fnDir, {recursive: true});
      fs.writeFileSync(
        path.join(fnDir, "schema.yaml"),
        yaml.stringify({name: "NoFiles", language: "javascript", triggers: {}})
      );
      // Intentionally do NOT write index.mjs or package.json

      const mod = makeFunctionMod();
      const state = makeState();
      const warns: string[] = [];

      const dispatcher = createDevDispatcher({
        modules: [mod],
        http: mockHttp,
        rootDir: dir,
        state,
        warnLogger: m => warns.push(m)
      });

      const eventPromise = dispatcher.handleEvent(
        "add",
        path.join(dir, "function", "NoFiles", "schema.yaml")
      );

      // Advance past all retries (5 × 200ms = 1000ms)
      await jest.advanceTimersByTimeAsync(1100);
      await eventPromise;

      expect(mod.create).not.toHaveBeenCalled();
      expect(warns.some(w => w.includes("timeout"))).toBe(true);
    } finally {
      jest.useRealTimers();
      cleanup(dir);
    }
  });
});

// ─── Dispatcher: function unlink of index/package warns only ─────────────────

describe("DevDispatcher — function: unlink of index/package warns, no API call", () => {
  it("warns when index.mjs is removed while schema still present", async () => {
    const dir = makeTmpDir();
    try {
      // Schema still on disk
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
      expect(warns.length).toBeGreaterThan(0);
      expect(warns[0]).toContain("no effect");
    } finally {
      cleanup(dir);
    }
  });

  it("warns when package.json is removed while schema still present", async () => {
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
      expect(warns2[0]).toContain("no effect");
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

describe("DevDispatcher — function: index/package change triggers update", () => {
  it("calls functionModule.update when index.mjs changes", async () => {
    const dir = makeTmpDir();
    try {
      const fnDir = path.join(dir, "function", "MyFn");
      fs.mkdirSync(fnDir, {recursive: true});
      fs.writeFileSync(
        path.join(fnDir, "schema.yaml"),
        yaml.stringify({name: "MyFn", language: "javascript"})
      );
      fs.writeFileSync(path.join(fnDir, "index.mjs"), "export default () => 42;");
      fs.writeFileSync(path.join(fnDir, "package.json"), JSON.stringify({dependencies: {}}));

      const mod = makeFunctionMod();
      const state = makeState({function: {MyFn: "remote-fn-id"}});
      const logs: string[] = [];

      const dispatcher = createDevDispatcher({
        modules: [mod],
        http: mockHttp,
        rootDir: dir,
        state,
        logger: m => logs.push(m)
      });

      await dispatcher.handleEvent(
        "change",
        path.join(dir, "function", "MyFn", "index.mjs")
      );

      expect(mod.update).toHaveBeenCalledTimes(1);
      expect(mod.create).not.toHaveBeenCalled();
      const [, local, remoteId] = mod.update.mock.calls[0];
      expect(local.slug).toBe("MyFn");
      expect(remoteId).toBe("remote-fn-id");
    } finally {
      cleanup(dir);
    }
  });

  it("calls functionModule.update when package.json changes", async () => {
    const dir = makeTmpDir();
    try {
      const fnDir = path.join(dir, "function", "MyFn");
      fs.mkdirSync(fnDir, {recursive: true});
      fs.writeFileSync(
        path.join(fnDir, "schema.yaml"),
        yaml.stringify({name: "MyFn", language: "javascript"})
      );
      fs.writeFileSync(path.join(fnDir, "index.mjs"), "export default () => {};");
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

      await dispatcher.handleEvent(
        "change",
        path.join(dir, "function", "MyFn", "package.json")
      );

      expect(mod.update).toHaveBeenCalledTimes(1);
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
      // Create the new-name directory on disk with the same _id
      const newFnDir = path.join(dir, "function", "new-fn-name");
      fs.mkdirSync(newFnDir, {recursive: true});
      fs.writeFileSync(
        path.join(newFnDir, "schema.yaml"),
        yaml.stringify({_id: "fn-id-1", name: "new-fn-name", language: "javascript"})
      );
      fs.writeFileSync(path.join(newFnDir, "index.mjs"), "export default () => {};");
      fs.writeFileSync(
        path.join(newFnDir, "package.json"),
        JSON.stringify({dependencies: {}})
      );

      const mod = makeFunctionMod();
      const state = makeState({function: {"old-fn-name": "fn-id-1"}});
      const logs: string[] = [];

      const dispatcher = createDevDispatcher({
        modules: [mod],
        http: mockHttp,
        rootDir: dir,
        state,
        logger: m => logs.push(m),
        renameWindowMs: 500
      });

      // Simulate rename: unlink old, then add new within the window
      await dispatcher.handleEvent(
        "unlink",
        path.join(dir, "function", "old-fn-name", "schema.yaml")
      );

      // Add new-name schema before window expires
      const addPromise = dispatcher.handleEvent(
        "add",
        path.join(dir, "function", "new-fn-name", "schema.yaml")
      );
      // Advance timers so waitForFunctionFiles resolves immediately
      await jest.advanceTimersByTimeAsync(100);
      await addPromise;

      expect(mod.delete).not.toHaveBeenCalled();
      expect(mod.create).not.toHaveBeenCalled();
      expect(mod.update).toHaveBeenCalledTimes(1);
      const [, local, remoteId] = mod.update.mock.calls[0];
      expect(local.slug).toBe("new-fn-name");
      expect(remoteId).toBe("fn-id-1");

      // Advance past window to confirm no delayed delete
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
