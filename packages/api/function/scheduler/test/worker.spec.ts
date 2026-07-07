import child_process from "child_process";
import {PassThrough} from "stream";
import {event} from "@spica-server/function-queue-proto";
import {WorkerState} from "@spica-server/interface-function-scheduler";
import {ScheduleWorker} from "../src/worker";

describe("ScheduleWorker state machine", () => {
  let spawnSpy: jest.SpyInstance;
  let mockProcess: any;

  beforeEach(() => {
    mockProcess = {
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      kill: jest.fn(),
      once: jest.fn().mockReturnThis(),
      killed: false
    };
    spawnSpy = jest.spyOn(child_process, "spawn").mockReturnValue(mockProcess as any);
  });

  afterEach(() => {
    spawnSpy.mockRestore();
  });

  function createWorker(): ScheduleWorker {
    return new ScheduleWorker({id: "worker-id", env: {}, entrypointPath: "fake-path"});
  }

  function target(id: string) {
    return new event.Target({id, cwd: "/tmp/fn", handler: "default"});
  }

  it("should start in the Initial state with no target", () => {
    const worker = createWorker();
    expect(worker.state).toEqual(WorkerState.Initial);
    expect(worker.hasSameTarget("1")).toBeFalsy();
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

    worker.markAsAvailable(() => {});
    expect(worker.state).toEqual(WorkerState.Warm);

    worker.execute(new event.Event({target: target("1"), type: -1 as any}));
    expect(worker.state).toEqual(WorkerState.Busy);

    worker.markAsAvailable(() => {});
    expect(worker.state).toEqual(WorkerState.Targeted);
  });

  it("should deliver the event to the stored schedule callback on execute", () => {
    const worker = createWorker();
    const schedule = jest.fn();
    const ev = new event.Event({target: target("1"), type: -1 as any});

    worker.markAsWarming(target("1"));
    worker.markAsAvailable(schedule);
    worker.execute(ev);

    expect(schedule).toHaveBeenCalledWith(ev);
  });

  it("should allow a warm worker to be outdated", () => {
    const worker = createWorker();

    worker.markAsWarming(target("1"));
    worker.markAsAvailable(() => {});
    worker.markAsOutdated();

    expect(worker.state).toEqual(WorkerState.Outdated);
  });

  it("should throw on an illegal transition", () => {
    const worker = createWorker();

    worker.markAsWarming(target("1"));
    worker.markAsAvailable(() => {});
    // Warm can only move to Busy/Timeouted/Outdated, never back to Warming
    expect(() => worker.markAsWarming(target("1"))).toThrow(/can not transition/);
  });
});
