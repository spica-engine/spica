import {ObjectId} from "@spica-server/database";
import {ArtifactStore} from "@spica-server/function/src/artifact/artifact-store";
import {SelfWriteTracker} from "@spica-server/function/src/asset-write-tracker";

describe("ArtifactStore", () => {
  const fn = {_id: new ObjectId(), name: "my-function"} as any;
  const descriptor = {
    inputs: {index: "i", packageJson: "p", lockfile: null, builder: "legacy"},
    platform: "linux-x64-glibc-abi127",
    key: "functions/my-function/artifacts/a.tar.gz"
  };
  const DAY = 24 * 60 * 60 * 1000;

  let strategy: Record<string, jest.Mock>;
  let artifactService: Record<string, jest.Mock>;
  let tracker: SelfWriteTracker;
  let store: ArtifactStore;

  beforeEach(() => {
    strategy = {
      list: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue(undefined)
    };
    artifactService = {
      upsertArtifact: jest.fn().mockResolvedValue(undefined),
      deleteByFunction: jest.fn().mockResolvedValue(1),
      findReferencedKeys: jest.fn().mockResolvedValue(new Set())
    };
    tracker = new SelfWriteTracker();
    store = new ArtifactStore(strategy as any, artifactService as any, tracker);
  });

  it("should record an archive for the descriptor's platform", async () => {
    await store.record(fn, descriptor, descriptor.key);

    expect(artifactService.upsertArtifact).toHaveBeenCalledWith(fn._id, descriptor.platform, {
      key: descriptor.key,
      inputs: descriptor.inputs,
      uploadDate: expect.any(Date)
    });
  });

  it("should recognize its own records, including unavailable ones", async () => {
    await store.record(fn, descriptor, descriptor.key);
    await store.record(fn, descriptor, null);

    expect(store.isSelfWrite({functionId: fn._id, key: descriptor.key})).toBe(true);
    expect(store.isSelfWrite({functionId: fn._id, key: null})).toBe(true);
    expect(store.isSelfWrite({functionId: fn._id, key: "functions/x/artifacts/b.tar.gz"})).toBe(
      false
    );
  });

  it("should delete a function's archives and records", async () => {
    strategy.list.mockResolvedValue([
      {key: "functions/my-function/artifacts/a.tar.gz", lastModified: new Date()}
    ]);

    await store.deleteFor(fn);

    expect(strategy.list).toHaveBeenCalledWith("functions/my-function/artifacts/");
    expect(strategy.delete).toHaveBeenCalledWith("functions/my-function/artifacts/a.tar.gz");
    expect(artifactService.deleteByFunction).toHaveBeenCalledWith(fn._id);
  });

  it("should find only unreferenced archives modified before the cutoff", async () => {
    const now = Date.now();
    strategy.list.mockResolvedValue([
      {key: "functions/fn/artifacts/old.tar.gz", lastModified: new Date(now - 2 * DAY)},
      {key: "functions/fn/artifacts/recent.tar.gz", lastModified: new Date(now)},
      {key: "functions/fn/artifacts/used.tar.gz", lastModified: new Date(now - 2 * DAY)},
      {key: "functions/fn/index.ts", lastModified: new Date(now - 2 * DAY)}
    ]);
    artifactService.findReferencedKeys.mockResolvedValue(
      new Set(["functions/fn/artifacts/used.tar.gz"])
    );

    expect(await store.findUnreferenced(now - DAY)).toEqual(["functions/fn/artifacts/old.tar.gz"]);
  });
});
