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

const buildWatcher = () =>
  new FunctionAssetWatcher(
    mockAssetService as any,
    mockFunctionService as any,
    mockReconciler as any,
    mockTracker as any,
    mockPreparationService as any
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
