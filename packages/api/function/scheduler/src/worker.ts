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

  private target!: event.Target;

  // capacity = max events the scheduler keeps in flight on this worker at once. It's the
  // function's per-function concurrency, set when the worker is pinned to a function — NOT
  // at spawn — so a generic worker can serve any function. `inFlight` counts events the
  // scheduler has pushed but not yet seen completed. The worker itself imposes no limit.
  public capacity = 1;
  private inFlight = 0;
  // Set once when the worker opens its event stream; pushes an event down that stream.
  private push!: Schedule;

  // Set when the function was updated but this worker still holds the old baked state. It keeps
  // serving (old code) so there's no cold-start gap, but is deprioritized behind fresh warm
  // replacements and retired the moment one takes over. See Scheduler.supersedeWorkers.
  private superseded = false;

  // Set on a worker spawned as a transient new-code replacement during a rolling cutover. Lets
  // the scheduler tell these apart from the steady-state warm reserve so the per-function
  // warmWorkers reconcile doesn't trim/kill them.
  private replacement = false;

  constructor(options: SpawnOptions) {
    super(options);
  }

  private transitionMap = {
    [WorkerState.Initial]: [WorkerState.Fresh, WorkerState.Warming],
    // Fresh/Warm -> Targeted covers a first execute that leaves free lanes (capacity > 1).
    [WorkerState.Fresh]: [WorkerState.Busy, WorkerState.Targeted],
    [WorkerState.Warming]: [WorkerState.Warm, WorkerState.Timeouted, WorkerState.Outdated],
    [WorkerState.Warm]: [
      WorkerState.Busy,
      WorkerState.Targeted,
      WorkerState.Timeouted,
      WorkerState.Outdated
    ],
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

  // Per-function concurrency, read from the scheduler on each assignment, so a live edit
  // resizes the worker on its next event without a respawn.
  public setCapacity(capacity: number) {
    this.capacity = Math.max(1, capacity || 1);
  }

  public execute(event: event.Event) {
    this.target = event.target;
    this.replacement = false;
    this.inFlight++;
    this.transitionTo(this.inFlight >= this.capacity ? WorkerState.Busy : WorkerState.Targeted);
    this.push(event);
  }

  public markAsWarming(target: event.Target) {
    this.target = target;
    this.transitionTo(WorkerState.Warming);
  }

  // Called once when the worker opens its event stream (its readiness signal). Registers
  // the push channel and graduates the worker to a servable state.
  public subscribed(push: Schedule) {
    this.push = push;

    if (this.state == WorkerState.Initial) {
      this.transitionTo(WorkerState.Fresh);
    } else if (this.state == WorkerState.Warming) {
      this.transitionTo(WorkerState.Warm);
    }
  }

  // A finished event frees a slot, so the worker can be handed the next one.
  public onComplete() {
    if (this.inFlight > 0) {
      this.inFlight--;
    }
    if (this.state == WorkerState.Busy) {
      this.transitionTo(WorkerState.Targeted);
    }
  }

  // Private on purpose: a free slot is only meaningful together with the worker's state
  // and target, so callers go through canServe*/isActiveFor and never risk pushing to a
  // worker that's already at its concurrency.
  private hasFreeSlot() {
    return (
      this.inFlight < this.capacity &&
      this.state != WorkerState.Timeouted &&
      this.state != WorkerState.Outdated
    );
  }

  // Reuse an already-graduated same-target worker with a free lane (its module cache
  // is warm and it already counts against this function's concurrency budget). Superseded
  // workers are excluded so a fresh warm replacement always wins over stale-but-hot code.
  public canServe(targetId: string) {
    return (
      this.hasSameTarget(targetId) &&
      this.state == WorkerState.Targeted &&
      !this.superseded &&
      this.hasFreeSlot()
    );
  }

  // Same, but for a worker still sitting in the pre-warmed reserve.
  public canServeWarm(targetId: string) {
    return this.hasSameTarget(targetId) && this.state == WorkerState.Warm && this.hasFreeSlot();
  }

  // A superseded (old-code) worker with a free lane. Used only after fresh warm replacements
  // are exhausted, to avoid a cold spawn while the rolling cutover is still in progress.
  public canServeSuperseded(targetId: string) {
    return this.hasSameTarget(targetId) && this.superseded && this.hasFreeSlot();
  }

  // Already handed at least one event of this function, so it counts toward the limit.
  public isActiveFor(targetId: string) {
    return (
      this.hasSameTarget(targetId) &&
      (this.state == WorkerState.Targeted || this.state == WorkerState.Busy)
    );
  }

  public isFresh() {
    return this.state == WorkerState.Fresh;
  }

  public isIdle() {
    return this.inFlight == 0;
  }

  public markAsTimeouted() {
    this.transitionTo(WorkerState.Timeouted);
  }

  public markAsOutdated() {
    this.transitionTo(WorkerState.Outdated);
  }

  // Keep serving old code until a fresh replacement is ready. Only meaningful for a worker that
  // is actively pinned to a function; the warm reserve is killed and rebuilt separately.
  public markAsSuperseded() {
    if (this.state == WorkerState.Targeted || this.state == WorkerState.Busy) {
      this.superseded = true;
    }
  }

  public get isSuperseded() {
    return this.superseded;
  }

  public markAsReplacement() {
    this.replacement = true;
  }

  public get isReplacement() {
    return this.replacement;
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

  public get targetId(): string | undefined {
    return this.target?.id;
  }
}
