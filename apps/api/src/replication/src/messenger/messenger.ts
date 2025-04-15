import {Injectable} from "@nestjs/common";
import {PartialObserver} from "rxjs";
import {IPubSub, Filter} from "@spica-server/interface/replication";

@Injectable()
export class Messenger<T> implements IPubSub<T> {
  filters: Filter<T>[] = [];
  memory: IPubSub<T>;

  constructor(_memory: IPubSub<T>) {
    this.memory = _memory;
  }

  subscribe(observer: PartialObserver<T>) {
    return this.memory.subscribe({
      next: msg => {
        if (!this.filters.every(filter => filter(msg))) {
          return;
        }
        observer.next(msg);
      }
    });
  }

  publish(msg: T) {
    return this.memory.publish(msg);
  }
}
