import {Subject} from "rxjs";
import {ObjectId} from "@spica-server/database";
import {FunctionEngine} from "@spica-server/function/src/engine";

describe("FunctionEngine resource change refresh", () => {
  const fnId = new ObjectId();

  let engine: any;

  beforeEach(() => {
    engine = Object.create(FunctionEngine.prototype);
    Object.assign(engine, {
      applyChangePlan: jest.fn().mockResolvedValue(undefined),
      refreshLocally: jest.fn().mockResolvedValue(undefined),
      logger: {error: jest.fn()}
    });
  });

  it("should refresh locally without broadcasting when an env var is updated", async () => {
    await engine.refreshLocallyAfterChange([{_id: fnId}], "update", jest.fn());

    expect(engine.refreshLocally).toHaveBeenCalledWith(fnId.toString());
    expect(engine.applyChangePlan).not.toHaveBeenCalled();
  });

  it("should detach before refreshing locally on delete", async () => {
    const order: string[] = [];
    const detach = jest.fn(async () => void order.push("detach"));
    engine.refreshLocally.mockImplementation(async () => void order.push("refresh"));

    await engine.refreshLocallyAfterChange([{_id: fnId}], "delete", detach);

    expect(detach).toHaveBeenCalledWith(fnId);
    expect(order).toEqual(["detach", "refresh"]);
    expect(engine.applyChangePlan).not.toHaveBeenCalled();
  });

  it("should not detach on non-delete operations", async () => {
    const detach = jest.fn();

    await engine.refreshLocallyAfterChange([{_id: fnId}], "replace", detach);

    expect(detach).not.toHaveBeenCalled();
  });

  it("should keep refreshing other functions when one fails", async () => {
    const other = new ObjectId();
    engine.refreshLocally.mockRejectedValueOnce(new Error("boom"));

    await engine.refreshLocallyAfterChange([{_id: fnId}, {_id: other}], "update", jest.fn());

    expect(engine.refreshLocally).toHaveBeenCalledWith(other.toString());
    expect(engine.logger.error).toHaveBeenCalledTimes(1);
  });

  describe("watcher wiring", () => {
    let envChanges: Subject<any>;
    let secretChanges: Subject<any>;
    let executor: {apply: jest.Mock};
    let wired: any;

    const flush = () => new Promise(resolve => setImmediate(resolve));

    beforeEach(() => {
      envChanges = new Subject();
      secretChanges = new Subject();
      executor = {apply: jest.fn().mockResolvedValue(undefined)};
      const fs = {
        watchFunctionsForEnvChanges: () => envChanges,
        watchFunctionsForSecretChanges: () => secretChanges,
        findOneAndUpdate: jest.fn().mockResolvedValue({})
      };
      wired = new FunctionEngine(
        fs as any,
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
        {} as any
      );
      wired.applyChangePlan = jest.fn();
    });

    afterEach(() => {
      envChanges.complete();
      secretChanges.complete();
    });

    it.each([
      ["env var", () => envChanges, "envVarId"],
      ["secret", () => secretChanges, "secretId"]
    ])("should refresh locally without broadcasting when a %s changes", async (_, source, key) => {
      source().next({fns: [{_id: fnId}], [key]: new ObjectId(), operationType: "update"});
      await flush();

      expect(executor.apply).toHaveBeenCalledTimes(1);
      expect(wired.applyChangePlan).not.toHaveBeenCalled();
    });
  });
});
