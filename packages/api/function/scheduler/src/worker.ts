import {EventEmitter} from "events";
import {Writable} from "stream";
import {event} from "@spica-server/function-queue-proto";
import {Runtime, Worker as RuntimeWorker} from "@spica-server/function-runtime";
import {NodeWorker} from "@spica-server/function-runtime-node";
import {PythonWorker} from "@spica-server/function-runtime-python";
import {Description, SpawnOptions} from "@spica-server/interface-function-runtime";
import {Schedule, WorkerState} from "@spica-server/interface-function-scheduler";

export class Node extends Runtime {
  description: Description = {
    name: "node",
    title: "Node.js 22",
    description: "Node.js® is a JavaScript runtime built on Chrome's V8 JavaScript engine."
  };

  spawn(options: SpawnOptions): ScheduleWorker {
    return new ScheduleWorker(this.description.name, new NodeWorker(options));
  }
}

export class Python extends Runtime {
  description: Description = {
    name: "python",
    title: "Python 3.12",
    description: "Python is an interpreted, high-level, general-purpose programming language."
  };

  spawn(options: SpawnOptions): ScheduleWorker {
    return new ScheduleWorker(this.description.name, new PythonWorker(options));
  }
}

/**
 * Wraps a runtime ``Worker`` with the scheduler-side state machine. The state
 * machine itself is language-agnostic; only the underlying process changes per
 * runtime.
 */
export class ScheduleWorker extends EventEmitter {
  private _state: WorkerState = WorkerState.Initial;
  public get state(): WorkerState {
    return this._state;
  }
  private set state(value: WorkerState) {
    this._state = value;
  }

  private target: event.Target;
  private schedule: Schedule;

  private transitionMap = {
    [WorkerState.Initial]: [WorkerState.Fresh],
    [WorkerState.Fresh]: [WorkerState.Busy],
    [WorkerState.Targeted]: [WorkerState.Busy, WorkerState.Timeouted, WorkerState.Outdated],
    [WorkerState.Busy]: [WorkerState.Targeted, WorkerState.Timeouted, WorkerState.Outdated],
    [WorkerState.Timeouted]: [WorkerState.Outdated],
    [WorkerState.Outdated]: [WorkerState.Timeouted]
  };

  constructor(
    public readonly runtime: string,
    private readonly inner: RuntimeWorker
  ) {
    super();
    // Forward "exit" so existing callers can keep using ``worker.once("exit")``.
    inner.once("exit", (...args: unknown[]) => this.emit("exit", ...args));
  }

  attach(stdout?: Writable, stderr?: Writable): void {
    this.inner.attach(stdout, stderr);
  }

  kill(): Promise<void> {
    return this.inner.kill();
  }

  public execute(event: event.Event) {
    this.transitionTo(WorkerState.Busy);
    this.target = event.target;
    this.schedule(event);
  }

  public markAsAvailable(schedule: Schedule) {
    if (this.state == WorkerState.Busy) {
      this.transitionTo(WorkerState.Targeted);
    } else if (this.state == WorkerState.Initial) {
      this.transitionTo(WorkerState.Fresh);
    }
    this.schedule = schedule;
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
