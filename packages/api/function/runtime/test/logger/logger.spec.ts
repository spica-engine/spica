import {generateLog, getLogs, logContext} from "@spica-server/function-runtime-logger";
import {LogChannels, LogLevels} from "@spica-server/interface-function-runtime";

// generateLog runs reserveLog, which reads the async context — so framing can be
// asserted directly without capturing the worker's stdout.
describe("logger event correlation", () => {
  it("parses legacy frames without an event id", () => {
    const framed = generateLog("hello", LogLevels.INFO);
    expect(framed).not.toContain("SPICA_LOG_EVENT");
    expect(getLogs(framed, LogChannels.OUT)).toEqual([
      {level: LogLevels.INFO, eventId: undefined, message: "hello"}
    ]);
  });

  it("tags a frame with the event id from the async context", () => {
    const framed = logContext.run({eventId: "evt-1"}, () =>
      generateLog("hello world", LogLevels.LOG)
    );

    expect(framed).toContain("evt-1");
    expect(getLogs(framed, LogChannels.OUT)).toEqual([
      {level: LogLevels.LOG, eventId: "evt-1", message: "hello world"}
    ]);
  });

  it("keeps the correct event id across an await boundary", async () => {
    const framed = await logContext.run({eventId: "evt-2"}, async () => {
      await Promise.resolve();
      return generateLog("after await", LogLevels.LOG);
    });

    expect(getLogs(framed, LogChannels.OUT)).toEqual([
      {level: LogLevels.LOG, eventId: "evt-2", message: "after await"}
    ]);
  });

  it("does not leak an event id across concurrent contexts", async () => {
    const [a, b] = await Promise.all([
      logContext.run({eventId: "A"}, async () => {
        await Promise.resolve();
        return generateLog("from a", LogLevels.LOG);
      }),
      logContext.run({eventId: "B"}, async () => {
        await Promise.resolve();
        return generateLog("from b", LogLevels.LOG);
      })
    ]);

    expect(getLogs(a, LogChannels.OUT)[0]).toMatchObject({eventId: "A", message: "from a"});
    expect(getLogs(b, LogChannels.OUT)[0]).toMatchObject({eventId: "B", message: "from b"});
  });

  it("omits the event id when no context is active", () => {
    const framed = generateLog("no context", LogLevels.LOG);
    expect(framed).not.toContain("SPICA_LOG_EVENT");
    expect(getLogs(framed, LogChannels.OUT)).toEqual([
      {level: LogLevels.LOG, eventId: undefined, message: "no context"}
    ]);
  });
});
