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

describe("CRUD resource reference removal", () => {
  const fnId = new ObjectId();
  const resourceId = new ObjectId();

  let fs: {findOneAndUpdate: jest.Mock};
  let engine: Record<string, jest.Mock>;

  beforeEach(() => {
    fs = {findOneAndUpdate: jest.fn().mockResolvedValue({_id: fnId})};
    engine = {
      applyChangePlan: jest.fn().mockResolvedValue(undefined),
      refreshLocally: jest.fn().mockResolvedValue(undefined)
    };
  });

  it("should pull the env var without refreshing workers", async () => {
    await CRUD.environment.removeReference(fs as any, fnId, resourceId);

    expect(fs.findOneAndUpdate).toHaveBeenCalledWith({_id: fnId}, {$pull: {env_vars: resourceId}});
    expect(engine.applyChangePlan).not.toHaveBeenCalled();
  });

  it("should pull the secret without refreshing workers", async () => {
    await CRUD.secret.removeReference(fs as any, fnId, resourceId);

    expect(fs.findOneAndUpdate).toHaveBeenCalledWith({_id: fnId}, {$pull: {secrets: resourceId}});
    expect(engine.applyChangePlan).not.toHaveBeenCalled();
  });

  it("should throw when the function does not exist", async () => {
    fs.findOneAndUpdate.mockResolvedValue(null);

    await expect(CRUD.environment.removeReference(fs as any, fnId, resourceId)).rejects.toThrow(
      "not found"
    );
  });

  it("should still broadcast the refresh when ejecting through the endpoint", async () => {
    const ss = {findOne: jest.fn().mockResolvedValue({_id: resourceId, key: "API_KEY"})};

    await CRUD.secret.eject(fs as any, ss as any, fnId, engine as any, resourceId);

    expect(engine.applyChangePlan).toHaveBeenCalledTimes(1);
    expect(engine.refreshLocally).not.toHaveBeenCalled();
  });
});

describe("CRUD replace rename", () => {
  const _id = new ObjectId();
  const previous = {_id, name: "before", language: "javascript", timeout: 10, triggers: {}};

  let fs: {findOneAndUpdate: jest.Mock; replaceOne: jest.Mock};
  let engine: {moveAssets: jest.Mock; applyChangePlan: jest.Mock};

  beforeEach(() => {
    fs = {
      findOneAndUpdate: jest.fn().mockResolvedValue({...previous}),
      replaceOne: jest.fn().mockResolvedValue(1)
    };
    engine = {
      moveAssets: jest.fn().mockResolvedValue(undefined),
      applyChangePlan: jest.fn().mockResolvedValue(undefined)
    };
  });

  const replace = (changes: object) =>
    CRUD.replace(
      fs as any,
      engine as any,
      {...previous, _id: _id.toHexString(), ...changes} as any
    );

  it("should move the assets before applying a plan that renames the directory", async () => {
    await replace({name: "after"});

    expect(engine.moveAssets).toHaveBeenCalledWith(
      expect.objectContaining({name: "before"}),
      "after"
    );
    expect(engine.applyChangePlan.mock.calls[0][0].rename).toEqual([{from: "before", to: "after"}]);
  });

  it("should not move assets when the name is unchanged", async () => {
    await replace({timeout: 20});

    expect(engine.moveAssets).not.toHaveBeenCalled();
    expect(engine.applyChangePlan).toHaveBeenCalledTimes(1);
  });

  it("should restore the previous document and skip the plan when moving the assets fails", async () => {
    engine.moveAssets.mockRejectedValue(new Error("bucket unavailable"));

    await expect(replace({name: "after"})).rejects.toThrow(
      "Failed to move the files of function before to after: bucket unavailable"
    );

    expect(fs.replaceOne).toHaveBeenCalledWith({_id}, expect.objectContaining({name: "before"}));
    expect(engine.applyChangePlan).not.toHaveBeenCalled();
  });

  it("should reject a name that is already taken as a bad request", async () => {
    fs.findOneAndUpdate.mockRejectedValue({code: 11000, keyValue: {name: "after"}});

    await expect(replace({name: "after"})).rejects.toMatchObject({
      status: 400,
      message: "Value of the property .name should unique across all documents."
    });
    expect(engine.moveAssets).not.toHaveBeenCalled();
  });
});
