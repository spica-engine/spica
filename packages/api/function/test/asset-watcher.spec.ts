import {Subject} from "rxjs";
import {FunctionAssetWatcher} from "@spica-server/function/src/asset-watcher";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeFn = (id = "507f1f77bcf86cd799439011") =>
  ({_id: {toHexString: () => id}, name: "my-function"}) as any;

const makeChange = (overrides: Record<string, unknown> = {}) => ({
  fullDocument: {
    functionId: {toHexString: () => "507f1f77bcf86cd799439011"},
    filename: "index.ts",
    hash: "abc123",
    ...overrides
  }
});

let changeSubject: Subject<unknown>;

let mockAssetService: {watch: jest.Mock};
let mockFunctionService: {findOne: jest.Mock};
let mockReconciler: {reconcileFunction: jest.Mock};
let mockTracker: {isSelfWrite: jest.Mock};
let mockPreparationService: {deleteFunctionDirectory: jest.Mock};
let mockExecutor: {apply: jest.Mock};
let mockArtifactService: {watch: jest.Mock};
let mockArtifactManager: {runExclusive: jest.Mock} | undefined;
let artifactSubject: Subject<unknown>;

const buildWatcher = () =>
  new FunctionAssetWatcher(
    mockAssetService as any,
    mockFunctionService as any,
    mockReconciler as any,
    mockTracker as any,
    mockPreparationService as any,
    mockExecutor as any,
    mockArtifactService as any,
    mockArtifactManager as any
  );

const makeDeleteChange = (key = "functions/my-function/index.ts") => ({
  operationType: "delete",
  documentKey: {_id: "507f1f77bcf86cd799439011"},
  fullDocumentBeforeChange: {
    functionId: {toHexString: () => "507f1f77bcf86cd799439011"},
    filename: "index.ts",
    hash: "abc123",
    key
  }
});

beforeEach(() => {
  changeSubject = new Subject();

  mockAssetService = {
    watch: jest.fn().mockReturnValue(changeSubject.asObservable())
  };

  mockFunctionService = {
    findOne: jest.fn().mockResolvedValue(makeFn())
  };

  mockReconciler = {
    reconcileFunction: jest.fn().mockResolvedValue(undefined)
  };

  mockTracker = {
    isSelfWrite: jest.fn().mockReturnValue(false)
  };

  mockPreparationService = {
    deleteFunctionDirectory: jest.fn().mockResolvedValue(undefined)
  };

  mockExecutor = {
    apply: jest.fn().mockResolvedValue(undefined)
  };

  artifactSubject = new Subject();
  mockArtifactService = {
    watch: jest.fn().mockReturnValue(artifactSubject.asObservable())
  };
  mockArtifactManager = undefined;
});

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe("FunctionAssetWatcher — happy path", () => {
  it("should call reconcileFunction when a peer change arrives for a known function", async () => {
    const watcher = buildWatcher();
    watcher.onModuleInit();

    changeSubject.next(makeChange());
    // Wait for async handlers in the subscribe callback
    await new Promise(r => setTimeout(r, 0));

    expect(mockReconciler.reconcileFunction).toHaveBeenCalledTimes(1);
    expect(mockReconciler.reconcileFunction).toHaveBeenCalledWith(
      expect.objectContaining({name: "my-function"})
    );

    watcher.onModuleDestroy();
  });

  it("should call functionService.findOne with the correct {_id: functionId} query", async () => {
    const watcher = buildWatcher();
    watcher.onModuleInit();

    changeSubject.next(makeChange());
    await new Promise(r => setTimeout(r, 0));

    expect(mockFunctionService.findOne).toHaveBeenCalledWith({
      _id: expect.objectContaining({toHexString: expect.any(Function)})
    });

    watcher.onModuleDestroy();
  });
});

// ---------------------------------------------------------------------------
// Worker refresh after a peer sync
// ---------------------------------------------------------------------------

describe("FunctionAssetWatcher — worker refresh", () => {
  it("should refresh the function's workers locally only after the reconcile has finished", async () => {
    let finishReconcile: () => void;
    mockReconciler.reconcileFunction.mockReturnValue(
      new Promise<void>(resolve => (finishReconcile = resolve))
    );

    const watcher = buildWatcher();
    watcher.onModuleInit();

    changeSubject.next(makeChange());
    await new Promise(r => setTimeout(r, 0));

    expect(mockExecutor.apply).not.toHaveBeenCalled();

    finishReconcile();
    await new Promise(r => setTimeout(r, 0));

    expect(mockExecutor.apply).toHaveBeenCalledTimes(1);
    expect(mockExecutor.apply).toHaveBeenCalledWith({
      routing: [],
      outdate: ["507f1f77bcf86cd799439011"],
      reconcile: ["507f1f77bcf86cd799439011"]
    });

    watcher.onModuleDestroy();
  });
});

// ---------------------------------------------------------------------------
// Self-write suppression
// ---------------------------------------------------------------------------

describe("FunctionAssetWatcher — self-write suppression", () => {
  it("should NOT call reconcileFunction when tracker.isSelfWrite returns true", async () => {
    mockTracker.isSelfWrite.mockReturnValue(true);

    const watcher = buildWatcher();
    watcher.onModuleInit();

    changeSubject.next(makeChange());
    await new Promise(r => setTimeout(r, 0));

    expect(mockReconciler.reconcileFunction).not.toHaveBeenCalled();

    watcher.onModuleDestroy();
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("FunctionAssetWatcher — edge cases", () => {
  it("should skip the event when fullDocument has no functionId", async () => {
    const watcher = buildWatcher();
    watcher.onModuleInit();

    changeSubject.next({fullDocument: {filename: "index.ts", hash: "abc"}});
    await new Promise(r => setTimeout(r, 0));

    expect(mockFunctionService.findOne).not.toHaveBeenCalled();
    expect(mockReconciler.reconcileFunction).not.toHaveBeenCalled();

    watcher.onModuleDestroy();
  });

  it("should warn and NOT call reconcileFunction when the function is not found", async () => {
    mockFunctionService.findOne.mockResolvedValue(null);

    const watcher = buildWatcher();
    watcher.onModuleInit();

    changeSubject.next(makeChange());
    await new Promise(r => setTimeout(r, 0));

    expect(mockReconciler.reconcileFunction).not.toHaveBeenCalled();

    watcher.onModuleDestroy();
  });

  it("should keep the subscription alive when reconcileFunction throws", async () => {
    mockReconciler.reconcileFunction
      .mockRejectedValueOnce(new Error("reconcile failed"))
      .mockResolvedValue(undefined);

    const watcher = buildWatcher();
    watcher.onModuleInit();

    // First event throws
    changeSubject.next(makeChange());
    await new Promise(r => setTimeout(r, 0));

    // Second event should still be handled
    changeSubject.next(makeChange());
    await new Promise(r => setTimeout(r, 0));

    expect(mockReconciler.reconcileFunction).toHaveBeenCalledTimes(2);

    watcher.onModuleDestroy();
  });
});

// ---------------------------------------------------------------------------
// Delete event handling
// ---------------------------------------------------------------------------

describe("FunctionAssetWatcher — delete events", () => {
  it("should call deleteFunctionDirectory with the function name parsed from the key", async () => {
    const watcher = buildWatcher();
    watcher.onModuleInit();

    changeSubject.next(makeDeleteChange("functions/my-function/index.ts"));
    await new Promise(r => setTimeout(r, 0));

    expect(mockPreparationService.deleteFunctionDirectory).toHaveBeenCalledWith("my-function");

    watcher.onModuleDestroy();
  });

  it("should NOT call reconcileFunction for a delete event", async () => {
    const watcher = buildWatcher();
    watcher.onModuleInit();

    changeSubject.next(makeDeleteChange());
    await new Promise(r => setTimeout(r, 0));

    expect(mockReconciler.reconcileFunction).not.toHaveBeenCalled();

    watcher.onModuleDestroy();
  });

  it("should keep the subscription alive when deleteFunctionDirectory throws", async () => {
    mockPreparationService.deleteFunctionDirectory
      .mockRejectedValueOnce(new Error("rimraf failed"))
      .mockResolvedValue(undefined);

    const watcher = buildWatcher();
    watcher.onModuleInit();

    changeSubject.next(makeDeleteChange());
    await new Promise(r => setTimeout(r, 0));

    changeSubject.next(makeDeleteChange());
    await new Promise(r => setTimeout(r, 0));

    expect(mockPreparationService.deleteFunctionDirectory).toHaveBeenCalledTimes(2);

    watcher.onModuleDestroy();
  });
});

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

describe("FunctionAssetWatcher — lifecycle", () => {
  it("should subscribe to assetService.watch on onModuleInit with correct pipeline and options", () => {
    const watcher = buildWatcher();
    watcher.onModuleInit();

    expect(mockAssetService.watch).toHaveBeenCalledTimes(1);
    const [pipeline, options] = mockAssetService.watch.mock.calls[0];
    // Pipeline should filter on the relevant operationTypes
    expect(pipeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          $match: expect.objectContaining({operationType: expect.anything()})
        })
      ])
    );
    // Must request pre-change document so delete events carry fullDocumentBeforeChange
    expect(options).toMatchObject({fullDocumentBeforeChange: "whenAvailable"});

    watcher.onModuleDestroy();
  });

  it("should unsubscribe on onModuleDestroy", () => {
    const watcher = buildWatcher();
    watcher.onModuleInit();

    const unsubscribeSpy = jest.spyOn((watcher as any).subscription, "unsubscribe");

    watcher.onModuleDestroy();

    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
  });

  it("should not throw when onModuleDestroy is called on an already-closed subscription", () => {
    const watcher = buildWatcher();
    watcher.onModuleInit();
    watcher.onModuleDestroy();

    // Second destroy should be safe
    expect(() => watcher.onModuleDestroy()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Prebuilt artifacts
// ---------------------------------------------------------------------------

describe("FunctionAssetWatcher — prebuilt artifacts", () => {
  const makeArtifactChange = (key: string | null = "functions/my-function/artifacts/a.tar.gz") => ({
    operationType: "update",
    fullDocument: {
      functionId: {toHexString: () => "507f1f77bcf86cd799439011"},
      platform: "linux-x64-glibc-abi127",
      key
    }
  });

  const flush = () => new Promise(r => setTimeout(r, 0));

  beforeEach(() => {
    mockArtifactManager = {runExclusive: jest.fn((_name, task) => task())};
    (mockReconciler as any).syncSources = jest.fn().mockResolvedValue([]);
    mockReconciler.reconcileFunction.mockResolvedValue(true);
  });

  it("should not watch artifacts without an artifact manager", () => {
    mockArtifactManager = undefined;
    const watcher = buildWatcher();
    watcher.onModuleInit();

    expect(mockArtifactService.watch).not.toHaveBeenCalled();
    watcher.onModuleDestroy();
  });

  it("should only sync sources on an asset change, without rebuilding or refreshing", async () => {
    const watcher = buildWatcher();
    watcher.onModuleInit();

    changeSubject.next(makeChange());
    await flush();

    expect((mockReconciler as any).syncSources).toHaveBeenCalledTimes(1);
    expect(mockArtifactManager.runExclusive).toHaveBeenCalledWith(
      "my-function",
      expect.any(Function)
    );
    expect(mockReconciler.reconcileFunction).not.toHaveBeenCalled();
    expect(mockExecutor.apply).not.toHaveBeenCalled();
    watcher.onModuleDestroy();
  });

  it("should reconcile with fallback and refresh when a peer records an artifact", async () => {
    const watcher = buildWatcher();
    watcher.onModuleInit();

    artifactSubject.next(makeArtifactChange());
    await flush();

    expect(mockReconciler.reconcileFunction).toHaveBeenCalledWith(
      expect.objectContaining({name: "my-function"}),
      {allowFallback: true}
    );
    expect(mockExecutor.apply).toHaveBeenCalledWith({
      routing: [],
      outdate: ["507f1f77bcf86cd799439011"],
      reconcile: ["507f1f77bcf86cd799439011"]
    });
    watcher.onModuleDestroy();
  });

  it("should not refresh when the local tree already matched the artifact", async () => {
    mockReconciler.reconcileFunction.mockResolvedValue(false);
    const watcher = buildWatcher();
    watcher.onModuleInit();

    artifactSubject.next(makeArtifactChange());
    await flush();

    expect(mockReconciler.reconcileFunction).toHaveBeenCalledTimes(1);
    expect(mockExecutor.apply).not.toHaveBeenCalled();
    watcher.onModuleDestroy();
  });

  it("should ignore artifacts recorded by this replica", async () => {
    mockTracker.isSelfWrite.mockReturnValue(true);
    const watcher = buildWatcher();
    watcher.onModuleInit();

    artifactSubject.next(makeArtifactChange(null));
    await flush();

    expect(mockTracker.isSelfWrite).toHaveBeenCalledWith({
      functionId: "507f1f77bcf86cd799439011",
      filename: "artifact",
      hash: "unavailable"
    });
    expect(mockReconciler.reconcileFunction).not.toHaveBeenCalled();
    watcher.onModuleDestroy();
  });

  it("should keep the artifact subscription alive when reconciling throws", async () => {
    mockReconciler.reconcileFunction.mockRejectedValueOnce(new Error("boom"));
    const watcher = buildWatcher();
    watcher.onModuleInit();

    artifactSubject.next(makeArtifactChange());
    await flush();
    artifactSubject.next(makeArtifactChange());
    await flush();

    expect(mockReconciler.reconcileFunction).toHaveBeenCalledTimes(2);
    watcher.onModuleDestroy();
  });

  it("should unsubscribe from artifacts on onModuleDestroy", () => {
    const watcher = buildWatcher();
    watcher.onModuleInit();
    watcher.onModuleDestroy();

    expect(artifactSubject.observed).toBe(false);
  });
});
