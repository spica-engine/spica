import {event} from "@spica-server/function/queue/proto";
import {Description, Runtime, SpawnOptions} from "@spica-server/function/runtime";
import {NodeWorker} from "@spica-server/function/runtime/node";

export type Schedule = (event: event.Event) => void;

export class Node extends Runtime {
  description: Description = {
    name: "node",
    title: "Node.js 12",
    description: "Node.js® is a JavaScript runtime built on Chrome's V8 JavaScript engine."
  };

  spawn(options: SpawnOptions): ScheduleWorker {
    return new ScheduleWorker(options);
  }
}

export enum WorkerState {
  "Fresh",
  "Targeted",
  "Busy",
  "Timeouted",
  "Outdated"
}

export class ScheduleWorker extends NodeWorker {
  private _state: WorkerState = WorkerState.Fresh;
  public get state(): WorkerState {
    return this._state;
  }
  private set state(value: WorkerState) {
    this._state = value;
  }

  private target: event.Target;
  private schedule: Schedule;

  private transitionMap = {
    [WorkerState.Fresh]: [WorkerState.Busy],
    [WorkerState.Targeted]: [WorkerState.Busy, WorkerState.Timeouted, WorkerState.Outdated],
    [WorkerState.Busy]: [WorkerState.Targeted, WorkerState.Timeouted, WorkerState.Outdated],
    [WorkerState.Timeouted]: [WorkerState.Outdated],
    [WorkerState.Outdated]: [WorkerState.Timeouted]
  };

  public execute(event: event.Event) {
    this.transitionTo(WorkerState.Busy);
    this.target = event.target;
    this.schedule(event);
  }

  public markAsAvailable(schedule: Schedule) {
    if (this.state == WorkerState.Busy) {
      this.transitionTo(WorkerState.Targeted);
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
