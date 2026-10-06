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

  it("should refresh only the local replica after uninstalling dependencies", async () => {
    await CRUD.dependencies.uninstall(engine as any, fn, ["left-pad"]);

    expectLocalRefreshOnly();
  });
});
