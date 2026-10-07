import {ObjectId} from "@spica-server/database";
import * as CRUD from "@spica-server/function/src/crud";

describe("CRUD worker refresh", () => {
  const fnId = new ObjectId();
  const fn = {_id: fnId, name: "my-function", language: "typescript"} as any;

  let fs: {findOne: jest.Mock};
  let engine: Record<string, jest.Mock>;

  beforeEach(() => {
    fs = {findOne: jest.fn().mockResolvedValue(fn)};
    engine = {
      storeAssets: jest.fn((_fn, _filename, op) => op()),
      getIndexFilename: jest.fn().mockReturnValue("index.ts"),
      update: jest.fn().mockResolvedValue(undefined),
      build: jest.fn().mockResolvedValue(undefined),
      installPackages: jest.fn().mockResolvedValue(undefined),
      removePackage: jest.fn().mockResolvedValue(undefined),
      read: jest.fn().mockResolvedValue("{}"),
      refreshLocally: jest.fn().mockResolvedValue(undefined),
      applyChangePlan: jest.fn().mockResolvedValue(undefined)
    };
  });

  // Peers refresh themselves from the asset watcher once their copy is rebuilt; a replicated
  // refresh would reach them before that and preload the old build.
  function expectLocalRefreshOnly() {
    expect(engine.refreshLocally).toHaveBeenCalledTimes(1);
    expect(engine.refreshLocally).toHaveBeenCalledWith(fnId.toString());
    expect(engine.applyChangePlan).not.toHaveBeenCalled();
  }

  it("should refresh only the local replica after writing the index", async () => {
    await CRUD.index.write(fs as any, engine as any, fnId, "export default () => {}");

    expectLocalRefreshOnly();
  });

  it("should refresh only the local replica after installing dependencies", async () => {
    await CRUD.dependencies.install(engine as any, fn, ["left-pad@1.3.0"]);

    expectLocalRefreshOnly();
  });

  it("should not rebuild after installing dependencies without an artifact manager", async () => {
    await CRUD.dependencies.install(engine as any, fn, ["left-pad@1.3.0"]);

    expect(engine.build).not.toHaveBeenCalled();
  });

  it("should refresh only the local replica after uninstalling dependencies", async () => {
    await CRUD.dependencies.uninstall(engine as any, fn, ["left-pad"]);

    expectLocalRefreshOnly();
  });
});

describe("CRUD prebuilt artifacts", () => {
  const fnId = new ObjectId();
  const fn = {_id: fnId, name: "my-function", language: "typescript"} as any;

  let fs: {findOne: jest.Mock};
  let engine: Record<string, any>;
  let calls: string[];

  beforeEach(() => {
    calls = [];
    const track =
      (name: string, value?: unknown) =>
      async (..._args: unknown[]) => {
        calls.push(name);
        return value;
      };
    fs = {findOne: jest.fn().mockResolvedValue(fn)};
    engine = {
      storeAssets: jest.fn(async (_fn, _filename, op) => {
        await op();
        calls.push("storeAssets");
      }),
      getIndexFilename: jest.fn().mockReturnValue("index.ts"),
      update: jest.fn(track("update")),
      build: jest.fn(track("build")),
      installPackages: jest.fn(track("installPackages")),
      removePackage: jest.fn(track("removePackage")),
      read: jest.fn().mockResolvedValue("{}"),
      refreshLocally: jest.fn(track("refreshLocally")),
      artifactManager: {
        publish: jest.fn(track("publish")),
        rebuild: jest.fn(track("rebuild", true))
      }
    };
  });

  it("should publish the artifact after storing the index and before refreshing", async () => {
    await CRUD.index.write(fs as any, engine as any, fnId, "export default () => {}");

    expect(calls).toEqual(["update", "build", "storeAssets", "publish", "refreshLocally"]);
  });

  it("should rebuild inside the install op, then publish, then refresh", async () => {
    await CRUD.dependencies.install(engine as any, fn, ["left-pad@1.3.0"]);

    expect(calls).toEqual([
      "installPackages",
      "rebuild",
      "storeAssets",
      "publish",
      "refreshLocally"
    ]);
    expect(engine.artifactManager.publish).toHaveBeenCalledWith(fn, {buildFailed: false});
  });

  it("should publish an unavailable artifact when the rebuild after install fails", async () => {
    engine.artifactManager.rebuild.mockResolvedValue(false);

    await CRUD.dependencies.install(engine as any, fn, ["left-pad@1.3.0"]);

    expect(engine.artifactManager.publish).toHaveBeenCalledWith(fn, {buildFailed: true});
  });

  it("should rebuild inside the uninstall op, then publish, then refresh", async () => {
    await CRUD.dependencies.uninstall(engine as any, fn, ["left-pad"]);

    expect(calls).toEqual(["removePackage", "rebuild", "storeAssets", "publish", "refreshLocally"]);
  });
});
