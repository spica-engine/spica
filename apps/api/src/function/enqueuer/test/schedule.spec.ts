import {Test} from "@nestjs/testing";
import {ScheduleEnqueuer} from "@spica-server/function/enqueuer";
import {EventQueue} from "@spica-server/function/queue";
import {event} from "@spica-server/function/queue/proto";

function createTarget(cwd?: string, handler?: string) {
  const target = new event.Target();
  target.cwd = cwd || "/tmp/fn1";
  target.handler = handler || "default";
  return target;
}

describe("ScheduleEnqueuer", () => {
  let eventQueue: {enqueue: jest.Mock};
  let enqueuer: ScheduleEnqueuer;
  let noopTarget: event.Target;

  let schedulerUnsubscriptionSpy: jest.Mock;

  beforeEach(async () => {
    eventQueue = {
      enqueue: jest.fn()
    };

    schedulerUnsubscriptionSpy = jest.fn();

    enqueuer = new ScheduleEnqueuer(eventQueue as any, schedulerUnsubscriptionSpy);

    noopTarget = createTarget();

    jest.useFakeTimers();
    jest.setSystemTime(new Date(2015, 1, 1, 1, 1, 31, 0));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should subscribe", () => {
    enqueuer.subscribe(noopTarget, {
      timezone: undefined,
      frequency: "* * * * *"
    });

    expect(enqueuer["jobs"].size).toEqual(1);

    const jobTarget = (Array.from(enqueuer["jobs"]) as any[]).map(j => j.target)[0];
    expect([jobTarget.cwd, jobTarget.handler]).toEqual(["/tmp/fn1", "default"]);
  });

  it("should unsubscribe", () => {
    const target1 = createTarget("/tmp/fn1", "handler1");
    const target2 = createTarget("/tmp/fn1", "handler2");
    const target3 = createTarget("/tmp/fn2", "handler1");

    enqueuer.subscribe(target1, {
      timezone: undefined,
      frequency: "* * * * *"
    });
    enqueuer.subscribe(target2, {
      timezone: undefined,
      frequency: "* * * * *"
    });
    enqueuer.subscribe(target3, {
      timezone: undefined,
      frequency: "* * * * *"
    });

    let jobs: any = Array.from(enqueuer["jobs"]);
    const stopSpies = jobs.map(j => jest.spyOn(j, "stop"));

    enqueuer.unsubscribe(target1);

    expect(stopSpies[0]).toHaveBeenCalledTimes(1);
    expect(stopSpies[1]).toHaveBeenCalledTimes(0);
    expect(stopSpies[2]).toHaveBeenCalledTimes(0);

    jobs = Array.from(enqueuer["jobs"]);

    expect(jobs.length).toEqual(2);

    expect(jobs.map(j => [j.target.cwd, j.target.handler])).toEqual([
      ["/tmp/fn1", "handler2"],
      ["/tmp/fn2", "handler1"]
    ]);

    expect(schedulerUnsubscriptionSpy).toHaveBeenCalledWith(target1.id);
  });

  it("should schedule the job", () => {
    expect(eventQueue.enqueue).not.toHaveBeenCalled();
    enqueuer.subscribe(noopTarget, {
      timezone: undefined,
      frequency: "* * * * *"
    });
    jest.advanceTimersByTime(1000 * 60 * 2);
    expect(eventQueue.enqueue).toHaveBeenCalledTimes(2);
  });
});
