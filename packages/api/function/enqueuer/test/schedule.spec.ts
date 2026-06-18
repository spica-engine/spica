import {Test} from "@nestjs/testing";
import {ScheduleEnqueuer} from "@spica-server/function-enqueuer";
import {EventQueue} from "@spica-server/function-queue";
import {event} from "@spica-server/function-queue-proto";
import {DatabaseTestingModule} from "@spica-server/database-testing";
import {JobReducer, JobService} from "@spica-server/replication";
import {REPLICATION_SERVICE_OPTIONS} from "@spica-server/interface-replication";
import {replicationServiceOptions} from "@spica-server/replication/testing";

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
    const cancelSpies = jobs.map(j => jest.spyOn(j, "cancel"));

    enqueuer.unsubscribe(target1);

    expect(cancelSpies[0]).toHaveBeenCalledTimes(1);
    expect(cancelSpies[1]).toHaveBeenCalledTimes(0);
    expect(cancelSpies[2]).toHaveBeenCalledTimes(0);

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

describe("ScheduleEnqueuer multi-replica", () => {
  let module;
  let jobReducer: JobReducer;

  // Two enqueuers standing in for two API replicas that share the same MongoDB
  // "jobs" collection (the cross-replica dedup lock used by JobReducer).
  let replicaA: ScheduleEnqueuer;
  let replicaB: ScheduleEnqueuer;
  let queueA: {enqueue: jest.Mock};
  let queueB: {enqueue: jest.Mock};

  const target = createTarget("/tmp/fn1", "default");
  const options = {timezone: undefined, frequency: "* * * * *"};

  function totalEnqueues() {
    return queueA.enqueue.mock.calls.length + queueB.enqueue.mock.calls.length;
  }

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.standalone()],
      providers: [
        {provide: REPLICATION_SERVICE_OPTIONS, useValue: replicationServiceOptions},
        JobService,
        JobReducer
      ]
    }).compile();

    jobReducer = module.get(JobReducer);

    queueA = {enqueue: jest.fn()};
    queueB = {enqueue: jest.fn()};

    replicaA = new ScheduleEnqueuer(queueA as any, jest.fn(), jobReducer);
    replicaB = new ScheduleEnqueuer(queueB as any, jest.fn(), jobReducer);
  });

  afterEach(async () => {
    await module.close();
  });

  it("should enqueue a scheduled tick on only one replica", async () => {
    // node-schedule hands every replica the same planned fireDate, so firedAt is
    // identical across replicas and the JobReducer key matches.
    const firedAt = 1000;
    await replicaA.onTickHandler(target, options, firedAt);
    await replicaB.onTickHandler(target, options, firedAt);

    expect(totalEnqueues()).toEqual(1);
  });

  it("should re-dispatch a shifted event on only one replica even when replicas disagree on the wall clock", async () => {
    // When a draining replica shifts an in-flight event, the SHIFT command is broadcast
    // to every surviving replica and each recomputes `firedAt` from its own clock
    // (ScheduleEnqueuer.shift -> `new Date(...)`). Two replicas crossing a second boundary
    // therefore produce different firedAt values for the SAME event id.
    const eventId = "shifted-event-id";
    const firedAtOnReplicaA = 1000;
    const firedAtOnReplicaB = 2000;

    await replicaA.onTickHandler(target, options, firedAtOnReplicaA, eventId);
    await replicaB.onTickHandler(target, options, firedAtOnReplicaB, eventId);

    expect(totalEnqueues()).toEqual(1);
  });
});
