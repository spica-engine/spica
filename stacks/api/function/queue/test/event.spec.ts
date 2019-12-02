import {EventQueue} from "@spica-server/function/queue";
import {Event} from "@spica-server/function/queue/proto";

describe("Event", () => {
  let eventQueue: EventQueue;

  // TODO: Test enqueue callback.

  beforeEach(() => {
    eventQueue = new EventQueue(() => {});
  });

  afterEach(() => {
    eventQueue.kill();
  });

  it("should enqueue event", () => {
    const event = new Event.Event();
    event.id = "1";
    event.type = Event.Type.DATABASE;
    eventQueue.enqueue(event);
  });

  it("should pop event", () => {
    const event = new Event.Event();
    event.id = "1";
    event.type = Event.Type.DATABASE;

    eventQueue.enqueue(event);
    const callbackSpy = jasmine.createSpy("unaryCallback");

    eventQueue.pop(null, callbackSpy);
    const lastCall = callbackSpy.calls.mostRecent();
    expect(callbackSpy).toHaveBeenCalledTimes(1);
    expect(lastCall.args[0]).toBeUndefined(); // Error
    expect(lastCall.args[1] instanceof Event.Event).toBe(true);
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
