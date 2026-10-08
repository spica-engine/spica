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
      readLockfile: jest.fn().mockResolvedValue(Buffer.from("lock")),
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

describe("CRUD dependency assets", () => {
  const fn = {_id: new ObjectId(), name: "my-function", language: "typescript"} as any;
  const lockfile = Buffer.from("lock");

  let engine: Record<string, jest.Mock>;
  let stored: Array<{filename: string; data: Buffer}>;

  beforeEach(() => {
    stored = [];
    engine = {
      storeAssets: jest.fn(async (_fn, filename, op) => {
        stored.push({filename, data: await op()});
      }),
      installPackages: jest.fn().mockResolvedValue(undefined),
      removePackage: jest.fn().mockResolvedValue(undefined),
      read: jest.fn().mockResolvedValue('{"name":"my-function"}'),
      readLockfile: jest.fn().mockResolvedValue(lockfile),
      refreshLocally: jest.fn().mockResolvedValue(undefined)
    };
  });

  const operations = [
    ["installing", () => CRUD.dependencies.install(engine as any, fn, ["left-pad@1.3.0"])],
    ["uninstalling", () => CRUD.dependencies.uninstall(engine as any, fn, ["left-pad"])]
  ] as const;

  for (const [name, run] of operations) {
    it(`should store package.json and then the lockfile after ${name} dependencies`, async () => {
      await run();

      expect(stored).toEqual([
        {filename: "package.json", data: Buffer.from('{"name":"my-function"}')},
        {filename: "package-lock.json", data: lockfile}
      ]);
    });

    it(`should skip the lockfile and still succeed when it is missing after ${name} dependencies`, async () => {
      engine.readLockfile.mockResolvedValue(null);

      await run();

      expect(stored.map(({filename}) => filename)).toEqual(["package.json"]);
      expect(engine.refreshLocally).toHaveBeenCalledTimes(1);
    });
  }

  it("should read the lockfile only after the packages are installed", async () => {
    await CRUD.dependencies.install(engine as any, fn, ["left-pad@1.3.0"]);

    expect(engine.installPackages.mock.invocationCallOrder[0]).toBeLessThan(
      engine.readLockfile.mock.invocationCallOrder[0]
    );
  });
});
