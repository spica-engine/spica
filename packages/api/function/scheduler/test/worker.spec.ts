import child_process from "child_process";
import {PassThrough} from "stream";
import {event} from "@spica-server/function-queue-proto";
import {WorkerState} from "@spica-server/interface-function-scheduler";
import {ScheduleWorker} from "../src/worker";

function mockSpawn() {
  const mockProcess: any = {
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill: jest.fn(),
    once: jest.fn().mockReturnThis(),
    killed: false
  };
  return jest.spyOn(child_process, "spawn").mockReturnValue(mockProcess as any);
}

function target(id: string) {
  return new event.Target({id, cwd: "/tmp/fn", handler: "default"});
}

describe("ScheduleWorker state machine", () => {
  let spawnSpy: jest.SpyInstance;

  beforeEach(() => (spawnSpy = mockSpawn()));
  afterEach(() => spawnSpy.mockRestore());

  function createWorker(): ScheduleWorker {
    return new ScheduleWorker({id: "worker-id", env: {}, entrypointPath: "fake-path"});
  }

  it("should start in the Initial state with no target", () => {
    const worker = createWorker();
    expect(worker.state).toEqual(WorkerState.Initial);
    expect(worker.hasSameTarget("1")).toBeFalsy();
  });

  it("should graduate Initial -> Fresh when it opens its event stream", () => {
    const worker = createWorker();
    worker.subscribed(() => {});
    expect(worker.state).toEqual(WorkerState.Fresh);
  });

  it("should bind a target and enter Warming on markAsWarming", () => {
    const worker = createWorker();

    worker.markAsWarming(target("1"));

    expect(worker.state).toEqual(WorkerState.Warming);
    // the target is known before any execution, so the scheduler can match it
    expect(worker.hasSameTarget("1")).toBe(true);
  });

  it("should walk Initial -> Warming -> Warm -> Busy -> Targeted", () => {
    const worker = createWorker();

    worker.markAsWarming(target("1"));
    expect(worker.state).toEqual(WorkerState.Warming);

    // opening the stream graduates a pre-warmed worker to Warm
    worker.subscribed(() => {});
    expect(worker.state).toEqual(WorkerState.Warm);

    // capacity defaults to 1, so one event saturates the worker
    worker.execute(new event.Event({target: target("1"), type: -1 as any}));
    expect(worker.state).toEqual(WorkerState.Busy);

    worker.onComplete();
    expect(worker.state).toEqual(WorkerState.Targeted);
  });

  it("should push the event down the registered stream on execute", () => {
    const worker = createWorker();
    const push = jest.fn();
    const ev = new event.Event({target: target("1"), type: -1 as any});

    worker.markAsWarming(target("1"));
    worker.subscribed(push);
    worker.execute(ev);

    expect(push).toHaveBeenCalledWith(ev);
  });

  it("should allow a warm worker to be outdated", () => {
    const worker = createWorker();

    worker.markAsWarming(target("1"));
    worker.subscribed(() => {});
    worker.markAsOutdated();

    expect(worker.state).toEqual(WorkerState.Outdated);
  });

  it("should throw on an illegal transition", () => {
    const worker = createWorker();

    worker.markAsWarming(target("1"));
    worker.subscribed(() => {});
    // Warm can only move to Busy/Targeted/Timeouted/Outdated, never back to Warming
    expect(() => worker.markAsWarming(target("1"))).toThrow(/can not transition/);
  });
});

describe("ScheduleWorker in-process concurrency", () => {
  let spawnSpy: jest.SpyInstance;

  beforeEach(() => (spawnSpy = mockSpawn()));
  afterEach(() => spawnSpy.mockRestore());

  // A subscribed worker pinned to function "1" with the given capacity, running `busy`
  // events. The scheduler sets capacity when it pins the worker to a function; the worker
  // itself imposes no limit.
  function busyWorker(capacity: number, busy: number): ScheduleWorker {
    const worker = new ScheduleWorker({id: "worker-id", env: {}, entrypointPath: "fake-path"});
    worker.subscribed(() => {});
    worker.setCapacity(capacity);
    for (let i = 0; i < busy; i++) {
      worker.execute(new event.Event({target: target("1"), type: -1 as any}));
    }
    return worker;
  }

  it("stays Targeted while it has a free slot and only turns Busy when full", () => {
    const worker = busyWorker(3, 2);
    expect(worker.state).toEqual(WorkerState.Targeted);
    expect(worker.canServe("1")).toBe(true);

    worker.execute(new event.Event({target: target("1"), type: -1 as any}));
    expect(worker.state).toEqual(WorkerState.Busy);
    // in-flight == capacity, so it must not be picked for another event
    expect(worker.canServe("1")).toBe(false);
  });

  it("frees a slot on completion so it can serve again", () => {
    const worker = busyWorker(2, 2);
    expect(worker.state).toEqual(WorkerState.Busy);
    expect(worker.canServe("1")).toBe(false);

    worker.onComplete();
    expect(worker.state).toEqual(WorkerState.Targeted);
    expect(worker.canServe("1")).toBe(true);
  });

  it("only serves the function it is pinned to", () => {
    const worker = busyWorker(3, 1);
    expect(worker.canServe("1")).toBe(true);
    expect(worker.canServe("2")).toBe(false);
  });

  it("times out the whole worker at the worker level", () => {
    // A single worker-keyed timeout retires the worker regardless of how many events are
    // in flight — the concurrency feature keeps master's worker-level timeout semantics.
    const worker = busyWorker(3, 3);

    expect(() => worker.markAsTimeouted()).not.toThrow();
    expect(worker.state).toEqual(WorkerState.Timeouted);
  });
});
