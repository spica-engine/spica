import {ScheduleEnqueuer} from "@spica-server/function/enqueuer";
import {EventQueue} from "@spica-server/function/queue";
import {event} from "@spica-server/function/queue/proto";

describe("ScheduleEnqueuer", () => {
  let eventQueue: jasmine.SpyObj<EventQueue>;
  let enqueuer: ScheduleEnqueuer;
  let noopTarget: event.Target;
  let clock: jasmine.Clock;

  beforeEach(() => {
    eventQueue = jasmine.createSpyObj("eventQueue", ["enqueue"]);
    enqueuer = new ScheduleEnqueuer(eventQueue);

    noopTarget = new event.Target();
    noopTarget.cwd = "/tmp/fn1";
    noopTarget.handler = "default";

    clock = jasmine.clock();
    clock.mockDate(new Date(2015, 1, 1, 1, 1, 31, 0));
    clock.install();
  });

  afterEach(() => {
    clock.uninstall();
  });

  it("should schedule the job", () => {
    expect(eventQueue.enqueue).not.toHaveBeenCalled();
    enqueuer.subscribe(noopTarget, {
      timezone: undefined,
      frequency: "* * * * *"
    });
    clock.tick(1000 * 60 * 2);
    expect(eventQueue.enqueue).toHaveBeenCalledTimes(2);
  });
});
