import {
  ReplicationServiceOptions,
  IPubSub,
  CommandMessengerOptions,
  CommandMessage,
  IJobReducer,
  JobMeta
} from "@spica/api/src/replication";
import {EventEmitter} from "events";
import {PartialObserver} from "rxjs";

export const replicationServiceOptions: ReplicationServiceOptions = {
  expireAfterSeconds: 60
};

export const cmdMessengerOptions: CommandMessengerOptions = {
  listenOwnCommands: false
};

export function wait(ms) {
  return Promise.resolve((resolve, _) => resolve(ms));
}

export class MockMemoryService implements IPubSub<CommandMessage> {
  emitter = new EventEmitter();

  publish(message: CommandMessage): void {
    this.emitter.emit("mock_event", message);
  }

  subscribe(observer: PartialObserver<CommandMessage>) {
    const callback = msg => observer.next(msg);
    this.emitter.on("mock_event", callback);

    return {
      unsubscribe: () => this.emitter.removeListener("mock_event", callback)
    };
  }

  clear() {
    this.emitter.removeAllListeners();
  }
}

export class MockJobReducer implements IJobReducer {
  jobsDone: JobMeta[] = [];

  do(meta: JobMeta, job: Function) {
    const isFirst = this.jobsDone.findIndex(j => j._id == meta._id) == -1;

    if (!isFirst) {
      return Promise.resolve(false);
    }

    this.jobsDone.push(meta);
    job();

    return Promise.resolve(true);
  }

  clear() {
    this.jobsDone = [];
  }
}
