import {EventLogRouter} from "@spica-server/function-runtime-io";
import {
  getLoggerConsole,
  getLogs,
  logContext,
  RESERVED_ENDING_INDICATOR as END,
  RESERVED_EVENT_INDICATOR as EVENT,
  RESERVED_LOG_LEVEL_INDICATOR as LEVEL,
  RESERVED_STARTING_INDICATOR as START
} from "@spica-server/function-runtime-logger";
import {LogChannels, LogLevels} from "@spica-server/interface-function-runtime";
import {Writable} from "stream";

function frame(eventId: string, message: string, level = 1) {
  return `${START}\n${LEVEL}${level}\n${EVENT}${eventId}\n ${message} \n${END}`;
}

function collector() {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk: any, _encoding: any, callback: any) {
      chunks.push(chunk.toString());
      callback();
    }
  });
  return {
    stream,
    text: () => chunks.join(""),
    count: () => chunks.length
  };
}

describe("EventLogRouter", () => {
  it("routes interleaved frames to the matching event's sinks", () => {
    const router = new EventLogRouter();
    const a = collector();
    const b = collector();
    router.register("A", [a.stream]);
    router.register("B", [b.stream]);

    router.input.write(frame("A", "from a") + frame("B", "from b") + frame("A", "again"));

    expect(a.text()).toContain("from a");
    expect(a.text()).toContain("again");
    expect(a.text()).not.toContain("from b");

    expect(b.text()).toContain("from b");
    expect(b.text()).not.toContain("from a");
  });

  it("fans a frame out to every sink registered for the event", () => {
    const router = new EventLogRouter();
    const db = collector();
    const stdout = collector();
    router.register("A", [db.stream, stdout.stream]);

    router.input.write(frame("A", "hello"));

    expect(db.text()).toContain("hello");
    expect(stdout.text()).toContain("hello");
  });

  it("buffers a frame split across chunk boundaries", () => {
    const router = new EventLogRouter();
    const a = collector();
    router.register("A", [a.stream]);

    const full = frame("A", "split across chunks");
    const mid = Math.floor(full.length / 2);

    router.input.write(full.slice(0, mid));
    expect(a.count()).toBe(0);

    router.input.write(full.slice(mid));
    expect(a.text()).toContain("split across chunks");
  });

  it("drops output that carries no frame at all", () => {
    const router = new EventLogRouter();
    const a = collector();
    router.register("A", [a.stream]);

    router.input.write("a bare stdout line\n");

    expect(a.count()).toBe(0);
  });

  it("drops frames for events that are no longer registered", () => {
    const router = new EventLogRouter();
    const a = collector();
    router.register("A", [a.stream]);
    router.unregister("A");

    router.input.write(frame("A", "should be dropped"));

    expect(a.count()).toBe(0);
  });
});

// The worker's console writes framed lines to its stdout/stderr, which the scheduler
// pipes into a router when the worker runs events concurrently. Spying on the copied
// console's sink reproduces that hop without spawning a worker.
describe("EventLogRouter fed by the logger console", () => {
  let out: EventLogRouter;
  let err: EventLogRouter;
  let stdout: jest.SpyInstance;
  let stderr: jest.SpyInstance;
  let loggerConsole: Console;

  beforeEach(() => {
    out = new EventLogRouter();
    err = new EventLogRouter();
    stdout = jest
      .spyOn(console, "log")
      .mockImplementation((...params: any[]) => out.input.write(params.join(" ") + "\n"));
    stderr = jest
      .spyOn(console, "error")
      .mockImplementation((...params: any[]) => err.input.write(params.join(" ") + "\n"));
    loggerConsole = getLoggerConsole();
  });

  afterEach(() => {
    stdout.mockRestore();
    stderr.mockRestore();
  });

  it("routes console.dir of concurrent events to their own sinks", () => {
    const a = collector();
    const b = collector();
    out.register("A", [a.stream]);
    out.register("B", [b.stream]);

    logContext.run({eventId: "A"}, () => loggerConsole.dir({from: "a"}));
    logContext.run({eventId: "B"}, () => loggerConsole.dir({from: "b"}));

    expect(getLogs(a.text(), LogChannels.OUT)).toEqual([
      {level: LogLevels.LOG, eventId: "A", message: "{ from: 'a' }"}
    ]);
    expect(getLogs(b.text(), LogChannels.OUT)).toEqual([
      {level: LogLevels.LOG, eventId: "B", message: "{ from: 'b' }"}
    ]);
  });

  it("keeps a multi line frame whole while another event logs alongside it", () => {
    const a = collector();
    const b = collector();
    out.register("A", [a.stream]);
    out.register("B", [b.stream]);

    logContext.run({eventId: "A"}, () => loggerConsole.table([{a: 1}]));
    logContext.run({eventId: "B"}, () => loggerConsole.dir("meanwhile"));

    const aLogs = getLogs(a.text(), LogChannels.OUT);
    expect(aLogs.length).toEqual(1);
    expect(aLogs[0].message).toContain("(index)");
    expect(aLogs[0].message.split("\n").length).toBeGreaterThan(1);
    expect(b.text()).not.toContain("(index)");
  });

  it("routes console.trace to the event's error sink", () => {
    const a = collector();
    err.register("A", [a.stream]);

    logContext.run({eventId: "A"}, () => loggerConsole.trace("boom"));

    const logs = getLogs(a.text(), LogChannels.ERROR);
    expect(logs.length).toEqual(1);
    expect(logs[0].level).toEqual(LogLevels.ERROR);
    expect(logs[0].eventId).toEqual("A");
    expect(logs[0].message).toMatch(/^Trace: boom/);
  });
});
