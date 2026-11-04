import {Subject} from "rxjs";
import {ObjectId} from "@spica-server/database";
import {FunctionEngine} from "@spica-server/function/src/engine";

describe("FunctionEngine resource change refresh", () => {
  const fnId = new ObjectId();
  const resourceId = new ObjectId();

  let envChanges: Subject<any>;
  let secretChanges: Subject<any>;
  let executor: {apply: jest.Mock};
  let dependents: {refreshPlan: jest.Mock};
  let fs: {removeReference: jest.Mock};
  let engine: any;

  const flush = () => new Promise(resolve => setImmediate(resolve));

  const sources = [
    ["env var", () => envChanges, {envVarId: resourceId}],
    ["secret", () => secretChanges, {secretId: resourceId, secretKeys: []}]
  ] as const;

  beforeEach(() => {
    envChanges = new Subject();
    secretChanges = new Subject();
    executor = {apply: jest.fn().mockResolvedValue(undefined)};
    dependents = {refreshPlan: jest.fn()};
    fs = {removeReference: jest.fn().mockResolvedValue({})};
    engine = new FunctionEngine(
      {
        watchFunctionsForEnvChanges: () => envChanges,
        watchFunctionsForSecretChanges: () => secretChanges
      } as any,
      {} as any,
      {} as any,
      undefined,
      {} as any,
      undefined,
      undefined,
      executor as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      dependents as any,
      {removeEnvVar: fs.removeReference, removeSecret: fs.removeReference} as any
    );
    engine.applyChangePlan = jest.fn();
    engine.logger = {error: jest.fn()};
  });

  afterEach(() => {
    envChanges.complete();
    secretChanges.complete();
  });

  it.each(sources)(
    "should refresh locally without broadcasting when a %s is updated",
    async (_, source, ids) => {
      source().next({fns: [{_id: fnId}], ...ids, operationType: "update"});
      await flush();

      expect(executor.apply).toHaveBeenCalledTimes(1);
      expect(executor.apply.mock.calls[0][0].reconcile).toEqual([fnId.toString()]);
      expect(engine.applyChangePlan).not.toHaveBeenCalled();
      expect(fs.removeReference).not.toHaveBeenCalled();
      // env vars and secrets belong to the importing worker's own process, so importers are unaffected
      expect(dependents.refreshPlan).not.toHaveBeenCalled();
    }
  );

  it.each(sources)(
    "should remove the reference before refreshing when a %s is deleted",
    async (_, source, ids) => {
      source().next({fns: [{_id: fnId}], ...ids, operationType: "delete"});
      await flush();

      expect(fs.removeReference).toHaveBeenCalledWith(fnId, expect.anything());
      expect(fs.removeReference.mock.invocationCallOrder[0]).toBeLessThan(
        executor.apply.mock.invocationCallOrder[0]
      );
      expect(engine.applyChangePlan).not.toHaveBeenCalled();
    }
  );

  it.each(sources)(
    "should keep refreshing other functions when one fails on a %s change",
    async (_, source, ids) => {
      const other = new ObjectId();
      executor.apply.mockRejectedValueOnce(new Error("boom"));

      source().next({fns: [{_id: fnId}, {_id: other}], ...ids, operationType: "update"});
      await flush();

      expect(executor.apply).toHaveBeenCalledTimes(2);
      expect(executor.apply.mock.calls[1][0].reconcile).toEqual([other.toString()]);
      expect(engine.logger.error).toHaveBeenCalledTimes(1);
    }
  );

  it("should refresh a function with its importers locally without broadcasting", async () => {
    const fn = {_id: fnId, name: "imported"};
    const plan = {
      routing: [],
      outdate: [fnId.toString(), "importer"],
      reconcile: [fnId.toString(), "importer"]
    };
    dependents.refreshPlan.mockResolvedValue(plan);

    await engine.refreshWithDependents(fn);

    expect(dependents.refreshPlan).toHaveBeenCalledWith(fn);
    expect(executor.apply).toHaveBeenCalledWith(plan);
    expect(engine.applyChangePlan).not.toHaveBeenCalled();
  });
});
