import {event} from "@spica-server/function-queue-proto";
import {Runtime} from "@spica-server/function-runtime";
import {NodeWorker} from "@spica-server/function-runtime-node";
import {Description, SpawnOptions} from "@spica-server/interface-function-runtime";
import {Schedule, WorkerState} from "@spica-server/interface-function-scheduler";

export class Node extends Runtime {
  description: Description = {
    name: "node",
    title: "Node.js 22",
    description: "Node.js® is a JavaScript runtime built on Chrome's V8 JavaScript engine."
  };

  spawn(options: SpawnOptions): ScheduleWorker {
    return new ScheduleWorker(options);
  }
}

export class ScheduleWorker extends NodeWorker {
  private _state: WorkerState = WorkerState.Initial;
  public get state(): WorkerState {
    return this._state;
  }
  private set state(value: WorkerState) {
    this._state = value;
  }

  private target: event.Target;

  // capacity = number of events this worker can run in-process at once (one per lane).
  // Each idle lane parks its pop callback in `pending`; `inFlight` counts busy lanes.
  private readonly capacity: number;
  private inFlight = 0;
  private stuckLanes = 0;
  private pending: Schedule[] = [];

  constructor(options: SpawnOptions) {
    super(options);
    this.capacity = Math.max(1, options.concurrency || 1);
  }

  private transitionMap = {
    [WorkerState.Initial]: [WorkerState.Fresh],
    [WorkerState.Fresh]: [WorkerState.Busy, WorkerState.Targeted],
    [WorkerState.Targeted]: [
      WorkerState.Busy,
      WorkerState.Targeted,
      WorkerState.Timeouted,
      WorkerState.Outdated
    ],
    [WorkerState.Busy]: [
      WorkerState.Busy,
      WorkerState.Targeted,
      WorkerState.Timeouted,
      WorkerState.Outdated
    ],
    [WorkerState.Timeouted]: [WorkerState.Outdated],
    [WorkerState.Outdated]: [WorkerState.Timeouted]
  };

  public execute(event: event.Event) {
    this.target = event.target;
    this.inFlight++;
    this.transitionTo(this.inFlight >= this.capacity ? WorkerState.Busy : WorkerState.Targeted);
    const schedule = this.pending.shift();
    schedule(event);
  }

  public markAsAvailable(schedule: Schedule) {
    this.pending.push(schedule);

    if (this.state == WorkerState.Initial) {
      this.transitionTo(WorkerState.Fresh);
      return;
    }

    // Further lanes parking their first pop before the worker is targeted.
    if (this.state == WorkerState.Fresh) {
      return;
    }

    // A lane finished its event and is asking for the next one.
    if (this.inFlight > 0) {
      this.inFlight--;
    }
    if (this.state == WorkerState.Busy) {
      this.transitionTo(WorkerState.Targeted);
    }
  }

  public hasFreeSlot() {
    return (
      this.pending.length > 0 &&
      this.inFlight < this.capacity &&
      this.state != WorkerState.Timeouted &&
      this.state != WorkerState.Outdated
    );
  }

  public isIdle() {
    return this.inFlight == 0;
  }

  // A timed-out lane keeps running the (uncancellable) handler; report when every
  // lane is wedged so the scheduler can replace the worker.
  public markLaneStuck() {
    this.stuckLanes++;
    return this.stuckLanes >= this.capacity;
  }

  public markAsTimeouted() {
    this.transitionTo(WorkerState.Timeouted);
  }

  public markAsOutdated() {
    this.transitionTo(WorkerState.Outdated);
  }

  private transitionTo(state: WorkerState) {
    const validStates = this.transitionMap[this.state];
    if (!validStates.includes(state)) {
      throw new Error(
        `Worker can not transition from ${WorkerState[this.state]} to ${WorkerState[state]}`
      );
    }

    this.state = state;
  }

  public hasSameTarget(targetId: string) {
    return this.target && this.target.id == targetId;
  }
}
