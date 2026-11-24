import {Logger} from "@nestjs/common";
import {LogChannels, LogLevels} from "@spica-server/interface-function-runtime";
import {PlaceholderDiagnostics} from "@spica-server/function/src/placeholder";

describe("PlaceholderDiagnostics", () => {
  const fn: any = {_id: "fn-id", name: "my-fn"};
  const placeholder = {prefix: "ENV" as const, key: "WARM"};

  let insert: jest.Mock;
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;

  const diagnostics = (workerLogOutput?: string[]) =>
    new PlaceholderDiagnostics({insert} as any, workerLogOutput);

  beforeEach(() => {
    insert = jest.fn().mockResolvedValue(undefined);
    warn = jest.spyOn(Logger.prototype, "warn").mockImplementation();
    error = jest.spyOn(Logger.prototype, "error").mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  it("should write an unresolved placeholder to the function logs as a warning", () => {
    diagnostics(["database"]).warnUnresolved(fn, "warmWorkers", placeholder);

    expect(insert).toHaveBeenCalledWith({
      function: "fn-id",
      event_id: "",
      channel: LogChannels.ERROR,
      level: LogLevels.WARN,
      content: "Failed to resolve ${ENV.WARM} in warmWorkers, falling back to defaults.",
      created_at: expect.any(Date)
    });
  });

  it("should write an invalid number to the function logs as a warning", () => {
    diagnostics(["database"]).warnInvalidNumber(fn, "warmWorkers", "abc", 0);

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        level: LogLevels.WARN,
        content: 'Resolved an invalid value "abc" for warmWorkers, falling back to 0.'
      })
    );
  });

  it("should always log to the API log, naming the function", () => {
    diagnostics(["stdout"]).warnUnresolved(fn, "warmWorkers", placeholder);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Function 'my-fn'"));
  });

  it.each([[undefined], [[]], [["stdout"]]])(
    "should not write to the function logs when worker log output is %p",
    workerLogOutput => {
      diagnostics(workerLogOutput as string[]).warnUnresolved(fn, "warmWorkers", placeholder);

      expect(insert).not.toHaveBeenCalled();
    }
  );

  it("should survive a failing log sink", async () => {
    insert.mockRejectedValue(new Error("db down"));

    diagnostics(["database"]).warnUnresolved(fn, "warmWorkers", placeholder);
    await new Promise(resolve => setImmediate(resolve));

    expect(error).toHaveBeenCalledWith(expect.stringContaining("db down"));
  });
});
