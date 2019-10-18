import {IsolatedVMExecutor} from "./executor";

describe("executor", () => {
  const target = {
    id: "",
    handler: "mytarget"
  };

  it("should execute print logs", async () => {
    const executor = new IsolatedVMExecutor();
    const logger = jasmine.createSpyObj("console", ["debug", "info", "log", "error", "warn"]);

    await executor.execute({
      environment: {},
      cwd: ".",
      logger,
      memoryLimit: 100,
      timeout: 100,
      parameters: [],
      target,
      script: `
        export function mytarget() {
            console.debug("console.debug");
            console.info("console.info");
            console.log("console.log");
            console.error("console.error");
            console.warn("console.warn");
        }
        `
    });
    expect(logger.debug).toHaveBeenCalledTimes(1);
    expect(logger.debug.calls.first().args[0]).toBe("console.debug");
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info.calls.first().args[0]).toBe("console.info");
    expect(logger.log).toHaveBeenCalledTimes(1);
    expect(logger.log.calls.first().args[0]).toBe("console.log");
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error.calls.first().args[0]).toBe("console.error");
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn.calls.first().args[0]).toBe("console.warn");
  });

  it("should pass parameters", async () => {
    const executor = new IsolatedVMExecutor();
    const arg1 = jasmine.createSpy("arg1");
    const arg2 = jasmine.createSpy("arg2");
    await executor.execute({
      environment: {},
      cwd: ".",
      logger: undefined,
      memoryLimit: 100,
      timeout: 100,
      parameters: [arg1, arg2],
      target,
      script: `
        export function mytarget(arg1, arg2) {
            arg1(123, "", true);
            arg2({}, []);
        }
        `
    });
    expect(arg1).toHaveBeenCalledTimes(1);
    expect(arg1.calls.first().args).toEqual([123, "", true]);
    expect(arg2).toHaveBeenCalledTimes(1);
    expect(arg2.calls.first().args).toEqual([{}, []]);
  });

  it("should pass return value from closure", async () => {
    const executor = new IsolatedVMExecutor();
    const logger = jasmine.createSpyObj("console", ["debug", "info", "log", "error", "warn"]);
    const execution = {
      environment: {},
      cwd: ".",
      logger,
      memoryLimit: 100,
      timeout: 100,
      parameters: [],
      target,
      script: `
      export function mytarget(arg1, arg2) {
        return [];
      }
      `
    };
    expect(await executor.execute(execution)).toEqual([]);
    execution.script = `
    export function mytarget(arg1, arg2) {
      return {test: {test: 1}};
    }
    `;
    expect(await executor.execute(execution)).toEqual({test: {test: 1}});
    execution.script = `
    export function mytarget(arg1, arg2) {
      return true;
    }
    `;
    expect(await executor.execute(execution)).toBe(true);
    execution.script = `
    export function mytarget(arg1, arg2) {
      return 213;
    }
    `;
    expect(await executor.execute(execution)).toBe(213);
    execution.script = `
    export function mytarget(arg1, arg2) {
      return "string";
    }
    `;
    expect(await executor.execute(execution)).toBe("string");
  });
});
