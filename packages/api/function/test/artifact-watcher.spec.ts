import {Subject} from "rxjs";
import {FunctionArtifactWatcher} from "@spica-server/function/src/artifact/artifact-watcher";

describe("FunctionArtifactWatcher", () => {
  const functionId = {toHexString: () => "507f1f77bcf86cd799439011"};
  const fn = {_id: functionId, name: "my-function"};

  const makeArtifactChange = (key: string | null = "functions/my-function/artifacts/a.tar.gz") => ({
    operationType: "update",
    fullDocument: {functionId, platform: "linux-x64-glibc-abi127", key}
  });

  const flush = () => new Promise(r => setTimeout(r, 0));

  let artifacts: Subject<unknown>;
  let artifactService: {watch: jest.Mock};
  let store: {isSelfWrite: jest.Mock};
  let functionService: {findOne: jest.Mock};
  let reconciler: {reconcileFunction: jest.Mock};
  let executor: {apply: jest.Mock};
  let watcher: FunctionArtifactWatcher;

  beforeEach(() => {
    artifacts = new Subject();
    artifactService = {watch: jest.fn().mockReturnValue(artifacts.asObservable())};
    store = {isSelfWrite: jest.fn().mockReturnValue(false)};
    functionService = {findOne: jest.fn().mockResolvedValue(fn)};
    reconciler = {reconcileFunction: jest.fn().mockResolvedValue(true)};
    executor = {apply: jest.fn().mockResolvedValue(undefined)};
    watcher = new FunctionArtifactWatcher(
      artifactService as any,
      store as any,
      functionService as any,
      reconciler as any,
      executor as any
    );
    watcher.onModuleInit();
  });

  afterEach(() => watcher.onModuleDestroy());

  it("should watch recorded artifacts", () => {
    expect(artifactService.watch).toHaveBeenCalledWith(
      [{$match: {operationType: {$in: ["insert", "update", "replace"]}}}],
      {fullDocument: "updateLookup"}
    );
  });

  it("should reconcile with fallback and refresh when a peer records an artifact", async () => {
    artifacts.next(makeArtifactChange());
    await flush();

    expect(reconciler.reconcileFunction).toHaveBeenCalledWith(fn, {allowFallback: true});
    expect(executor.apply).toHaveBeenCalledWith({
      routing: [],
      outdate: ["507f1f77bcf86cd799439011"],
      reconcile: ["507f1f77bcf86cd799439011"]
    });
  });

  it("should not refresh when the local tree already matched the artifact", async () => {
    reconciler.reconcileFunction.mockResolvedValue(false);

    artifacts.next(makeArtifactChange());
    await flush();

    expect(reconciler.reconcileFunction).toHaveBeenCalledTimes(1);
    expect(executor.apply).not.toHaveBeenCalled();
  });

  it("should ignore artifacts recorded by this replica", async () => {
    store.isSelfWrite.mockReturnValue(true);
    const change = makeArtifactChange(null);

    artifacts.next(change);
    await flush();

    expect(store.isSelfWrite).toHaveBeenCalledWith(change.fullDocument);
    expect(reconciler.reconcileFunction).not.toHaveBeenCalled();
  });

  it("should ignore artifacts of functions that no longer exist", async () => {
    functionService.findOne.mockResolvedValue(null);

    artifacts.next(makeArtifactChange());
    await flush();

    expect(reconciler.reconcileFunction).not.toHaveBeenCalled();
  });

  it("should keep the subscription alive when reconciling throws", async () => {
    reconciler.reconcileFunction.mockRejectedValueOnce(new Error("boom"));
    jest.spyOn((watcher as any).logger, "error").mockImplementation(() => {});

    artifacts.next(makeArtifactChange());
    await flush();
    artifacts.next(makeArtifactChange());
    await flush();

    expect(reconciler.reconcileFunction).toHaveBeenCalledTimes(2);
  });

  it("should unsubscribe on onModuleDestroy", () => {
    watcher.onModuleDestroy();

    expect(artifacts.observed).toBe(false);
  });
});
