import {EventQueue} from "@spica-server/function/queue";
import {event} from "@spica-server/function/queue/proto";

process.env.FUNCTION_GRPC_ADDRESS = "0.0.0.0:5847";

describe("EventQueue", () => {
  let eventQueue: EventQueue;
  let enqueueSpy: jest.Mock;
  let popSpy: jest.Mock;

  beforeEach(() => {
    enqueueSpy = jest.fn();
    popSpy = jest.fn();
    eventQueue = new EventQueue(
      () => {},
      enqueueSpy,
      popSpy,
      () => {}
    );
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
