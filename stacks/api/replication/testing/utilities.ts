import {
  ReplicationServiceOptions,
  IPubSub,
  CommandMessengerOptions,
  CommandMessage,
  Condition,
  ReplicaCondition
} from "@spica-server/replication";
import {EventEmitter} from "events";
import {Observable, of, PartialObserver, Subject, merge} from "rxjs";

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
    this.emitter.on("mock_event", msg => observer.next(msg));
  }

  clear() {
    this.emitter.removeAllListeners();
  }
}

export class MockConditionService {
  conditions: ReplicaCondition[] = [];
  subject = new Subject<ReplicaCondition[]>();

  findOneAndReplace(
    filter: {replicaId: string},
    doc: {replicaId: string; condition: Condition; module: string},
    options: {upsert: boolean}
  ) {
    let existing = this.conditions.findIndex(c => c.replicaId == filter.replicaId);

    if (existing == -1) {
      if (!options.upsert) {
        return;
      }
      this.conditions.push(doc);
    } else {
      this.conditions[existing] = doc;
    }

    return this.subject.next(this.conditions);
  }

  deleteMany(filter: {replicaId: string}) {
    this.conditions = this.conditions.filter(c => c.replicaId != filter.replicaId);
    this.subject.next(this.conditions);
  }

  watch(propagateOnStart: boolean): Observable<ReplicaCondition[]> {
    let src = this.subject.asObservable();
    if (propagateOnStart) {
      src = merge(of(this.conditions), src);
    }
    return src;
  }

  clear() {
    this.conditions = [];
    this.subject.next(this.conditions);
  }
}
