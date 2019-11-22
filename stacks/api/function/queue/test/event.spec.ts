import { EventQueue, EventType } from "@spica-server/function/queue";
import { Event } from "@spica-server/function/queue/proto";

describe("Event", () => {
  let eventQueue: EventQueue;

  beforeEach(() => {
    eventQueue = new EventQueue();
  });

  afterEach(() => {
    eventQueue.kill();
  });

  it("should enqueue event", () => {
    eventQueue.enqueue({
      id: "1",
      type: EventType.DATABASE
    });
  });

  it("should pop event", () => {
    const event = {
      id: "1",
      type: EventType.DATABASE
    };
    eventQueue.enqueue(event);
    const callbackSpy = jasmine.createSpy("unaryCallback");

    eventQueue.pop(null, callbackSpy);
    const lastCall = callbackSpy.calls.mostRecent();
    expect(callbackSpy).toHaveBeenCalledTimes(1);
    expect(lastCall.args[0]).toBeUndefined(); // Error
    expect(lastCall.args[1] instanceof Event).toBe(true);
  });

  it("should not pop a event and return an error", () => {
    const callbackSpy = jasmine.createSpy("unaryCallback");
    eventQueue.pop(null, callbackSpy);
    const lastCall = callbackSpy.calls.mostRecent();
    expect(callbackSpy).toHaveBeenCalledTimes(1);
    expect(lastCall.args[0] instanceof Error).toBe(true);
    expect(lastCall.args[0].message).toBe("Queue is empty.");
  });
});
