import {Test} from "@nestjs/testing";
import {ScheduleEnqueuer} from "@spica-server/function/enqueuer";
import {EventQueue} from "@spica-server/function/queue";
import {event} from "@spica-server/function/queue/proto";
import {JobReducer} from "@spica-server/replication";
import {ReplicationTestingModule} from "@spica-server/replication/testing";

function createTarget(cwd?: string, handler?: string) {
  const target = new event.Target();
  target.cwd = cwd || "/tmp/fn1";
  target.handler = handler || "default";
  return target;
}

describe("ScheduleEnqueuer", () => {
  let eventQueue: jasmine.SpyObj<EventQueue>;
  let enqueuer: ScheduleEnqueuer;
  let noopTarget: event.Target;
  let clock: jasmine.Clock;

  let schedulerUnsubscriptionSpy: jasmine.Spy;

  beforeEach(async () => {
    eventQueue = jasmine.createSpyObj("eventQueue", ["enqueue"]);

    schedulerUnsubscriptionSpy = jasmine.createSpy("unsubscription", () => {});

    const module = await Test.createTestingModule({
      imports: [ReplicationTestingModule.create()]
    }).compile();
    const jobReducer = module.get(JobReducer);

    enqueuer = new ScheduleEnqueuer(eventQueue, schedulerUnsubscriptionSpy, jobReducer);

    noopTarget = createTarget();

    clock = jasmine.clock();
    clock.mockDate(new Date(2015, 1, 1, 1, 1, 31, 0));
    clock.install();
  });

  afterEach(() => {
    clock.uninstall();
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

    let jobs = Array.from(enqueuer["jobs"]) as {stop: Function; target: event.Target}[];
    const stopSpies = jobs.map(j => spyOn(j, "stop"));

    enqueuer.unsubscribe(target1);

    expect(stopSpies[0]).toHaveBeenCalledTimes(1);
    expect(stopSpies[1]).toHaveBeenCalledTimes(0);
    expect(stopSpies[2]).toHaveBeenCalledTimes(0);

    jobs = Array.from(enqueuer["jobs"]) as {stop: Function; target: event.Target}[];

    expect(jobs.length).toEqual(2);

    expect(jobs.map(j => [j.target.cwd, j.target.handler])).toEqual([
      ["/tmp/fn1", "handler2"],
      ["/tmp/fn2", "handler1"]
    ]);

    expect(schedulerUnsubscriptionSpy).toHaveBeenCalledOnceWith(target1.id);
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
