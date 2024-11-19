import {EventQueue} from "@spica/api/src/function/queue";
import {event} from "@spica/api/src/function/queue/proto";

process.env.FUNCTION_GRPC_ADDRESS = "0.0.0.0:5847";

describe("EventQueue", () => {
  let eventQueue: EventQueue;
  let enqueueSpy: jasmine.Spy;
  let popSpy: jasmine.Spy;

  beforeEach(() => {
    enqueueSpy = jasmine.createSpy("enqueue");
    popSpy = jasmine.createSpy("pop");
    eventQueue = new EventQueue(() => {}, enqueueSpy, popSpy, () => {});
  });

  afterEach(() => {
    eventQueue.kill();
  });

  it("should enqueue event", () => {
    const ev = new event.Event();
    ev.type = event.Type.DATABASE;
    eventQueue.enqueue(ev);
    expect(enqueueSpy).toHaveBeenCalled();
    expect(ev.id).toBeTruthy();
  });
});
