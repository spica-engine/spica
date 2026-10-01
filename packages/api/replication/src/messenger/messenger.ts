import {Injectable, OnModuleDestroy} from "@nestjs/common";
import {PartialObserver} from "rxjs";
import {IPubSub, Filter} from "@spica-server/interface-replication";

/**
 * The subscriptions are dropped when the module is destroyed — the same contract
 * `CollectionChangeDispatcher` in this package already keeps.
 *
 * Underneath every subscription is a change stream on the `commands` collection. `ClassCommander.register`
 * opens one per controller and nothing closed them, so the stream outlived the module that owned it. In
 * production that means a change stream left open at shutdown; in tests it was louder — the stream kept
 * polling after its spec file ended and, once the server actually stopped, failed with
 * `MongoServerError: interrupted at shutdown`, which jest blamed on whichever **other** file happened to be
 * loading. That misdirection is the fourth instance of one class in this work (R99, `api/function/enqueuer`,
 * R114): work started against a resource has to be stopped by whoever started it.
 */
@Injectable()
export class Messenger<T> implements IPubSub<T>, OnModuleDestroy {
  filters: Filter<T>[] = [];
  memory: IPubSub<T>;

  private subscriptions = new Set<{unsubscribe: () => void}>();

  constructor(_memory: IPubSub<T>) {
    this.memory = _memory;
  }

  subscribe(observer: PartialObserver<T>) {
    const subscription = this.memory.subscribe({
      next: msg => {
        if (!this.filters.every(filter => filter(msg))) {
          return;
        }
        observer.next(msg);
      }
    });

    this.subscriptions.add(subscription);

    // The caller's own `unsubscribe` also deregisters, so a long-lived messenger does not accumulate
    // handles for subscriptions that are already gone.
    return {
      unsubscribe: () => {
        this.subscriptions.delete(subscription);
        subscription.unsubscribe();
      }
    };
  }

  publish(msg: T) {
    return this.memory.publish(msg);
  }

  onModuleDestroy() {
    for (const subscription of this.subscriptions) {
      subscription.unsubscribe();
    }
    this.subscriptions.clear();
  }
}
