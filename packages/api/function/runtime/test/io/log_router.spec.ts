import {EventLogRouter} from "@spica-server/function-runtime-io";
import {
  RESERVED_ENDING_INDICATOR as END,
  RESERVED_EVENT_INDICATOR as EVENT,
  RESERVED_LOG_LEVEL_INDICATOR as LEVEL,
  RESERVED_STARTING_INDICATOR as START
} from "@spica-server/function-runtime-logger";
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

  it("drops frames for events that are no longer registered", () => {
    const router = new EventLogRouter();
    const a = collector();
    router.register("A", [a.stream]);
    router.unregister("A");

    router.input.write(frame("A", "should be dropped"));

    expect(a.count()).toBe(0);
  });
});
