import {ArtifactGarbageCollector} from "@spica-server/function/src/artifact/artifact-gc";

describe("ArtifactGarbageCollector", () => {
  const DAY = 24 * 60 * 60 * 1000;
  let store: Record<string, jest.Mock>;
  let workspace: Record<string, jest.Mock>;
  let collector: ArtifactGarbageCollector;

  beforeEach(() => {
    store = {
      findUnreferenced: jest.fn().mockResolvedValue(["a", "b"]),
      delete: jest.fn().mockResolvedValue(undefined)
    };
    workspace = {prune: jest.fn().mockResolvedValue(undefined)};
    collector = new ArtifactGarbageCollector(store as any, workspace as any);
  });

  afterEach(() => collector.onModuleDestroy());

  it("should delete archives unreferenced for longer than a day and prune the workspace", async () => {
    const now = Date.now();

    await collector.collect(now);

    expect(store.findUnreferenced).toHaveBeenCalledWith(now - DAY);
    expect(store.delete).toHaveBeenCalledWith("a");
    expect(store.delete).toHaveBeenCalledWith("b");
    expect(workspace.prune).toHaveBeenCalledWith(now);
  });

  it("should keep deleting when one archive cannot be deleted", async () => {
    store.delete.mockRejectedValueOnce(new Error("denied"));
    jest.spyOn((collector as any).logger, "error").mockImplementation(() => {});

    await collector.collect();

    expect(store.delete).toHaveBeenCalledTimes(2);
    expect(workspace.prune).toHaveBeenCalled();
  });

  it("should schedule the first collection after startup instead of running it immediately", () => {
    jest.useFakeTimers();
    try {
      collector.onModuleInit();
      expect(store.findUnreferenced).not.toHaveBeenCalled();

      jest.advanceTimersByTime(10 * 60 * 1000);
      expect(store.findUnreferenced).toHaveBeenCalledTimes(1);
    } finally {
      collector.onModuleDestroy();
      jest.useRealTimers();
    }
  });
});
