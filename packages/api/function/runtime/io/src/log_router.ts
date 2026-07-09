import {Writable} from "stream";
import {
  RESERVED_ENDING_INDICATOR,
  RESERVED_EVENT_INDICATOR,
  RESERVED_STARTING_INDICATOR
} from "@spica-server/function-runtime-logger";

/**
 * Demultiplexes a worker's single output channel back into per-event sinks.
 *
 * When a worker runs several events concurrently their framed log messages
 * interleave on one stdout/stderr. Each frame carries its event id, so this
 * router buffers across chunk boundaries, extracts whole frames, and forwards
 * each to the sinks registered for its event. One router per channel per worker.
 *
 * Unframed output (no start marker) can't be attributed to an event and is
 * dropped — concurrent workers must run with the logger enabled.
 */
export class EventLogRouter {
  private sinks = new Map<string, Writable[]>();
  private buffer = "";
  readonly input: Writable;

  constructor() {
    this.input = new Writable({
      write: (chunk, _encoding, callback) => {
        this.route(chunk);
        callback();
      }
    });
  }

  register(eventId: string, sinks: Writable[]) {
    this.sinks.set(eventId, sinks);
  }

  unregister(eventId: string) {
    this.sinks.delete(eventId);
  }

  private route(chunk: Buffer | string) {
    this.buffer += chunk.toString();

    while (true) {
      const start = this.buffer.indexOf(RESERVED_STARTING_INDICATOR);
      if (start == -1) {
        this.buffer = "";
        return;
      }
      if (start > 0) {
        this.buffer = this.buffer.slice(start);
      }

      const end = this.buffer.indexOf(RESERVED_ENDING_INDICATOR);
      if (end == -1) {
        return;
      }

      const frameEnd = end + RESERVED_ENDING_INDICATOR.length;
      const frame = this.buffer.slice(0, frameEnd);
      this.buffer = this.buffer.slice(frameEnd);

      const eventId = this.extractEventId(frame);
      const sinks = eventId && this.sinks.get(eventId);
      if (sinks) {
        for (const sink of sinks) {
          if (sink.writable) {
            sink.write(frame);
          }
        }
      }
    }
  }

  private extractEventId(frame: string) {
    const at = frame.indexOf(RESERVED_EVENT_INDICATOR);
    if (at == -1) {
      return undefined;
    }
    const from = at + RESERVED_EVENT_INDICATOR.length;
    const newline = frame.indexOf("\n", from);
    return frame.slice(from, newline == -1 ? undefined : newline).trim();
  }
}
