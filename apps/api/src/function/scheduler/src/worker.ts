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
  "Busy"
}

export class ScheduleWorker extends NodeWorker {
  state: WorkerState = WorkerState.Fresh;
  target: event.Target;
  schedule: Schedule;
  isOutdated?: boolean;

  transitionMap = {
    [WorkerState.Fresh]: [WorkerState.Busy],
    [WorkerState.Targeted]: [WorkerState.Busy],
    [WorkerState.Busy]: [WorkerState.Targeted]
  };

  execute(event: event.Event) {
    this.transitionTo(WorkerState.Busy);
    this.target = event.target;
    this.schedule(event);
  }

  markAsAvailable(schedule: Schedule) {
    if (this.state == WorkerState.Busy) {
      this.transitionTo(WorkerState.Targeted);
    }
    this.schedule = schedule;
  }

  transitionTo(state: WorkerState) {
    const validStates = this.transitionMap[this.state];
    if (!validStates.includes(state)) {
      throw new Error(
        `Worker can not transition from ${WorkerState[this.state]} to ${WorkerState[state]}`
      );
    }

    this.state = state;
  }

  hasSameTarget(targetId: string) {
    return this.target && this.target.id == targetId;
  }
}
