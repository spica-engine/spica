import {Injectable, OnModuleDestroy, Optional} from "@nestjs/common";
import {Observable, Subject} from "rxjs";
import {Id} from "@spica-server/interface-data";
import {CommandType} from "@spica-server/interface-replication";
import {ClassCommander} from "./commander.js";

export interface CollectionChangeEvent {
  operationType: "insert" | "update" | "replace" | "delete";
  documentKey: {_id: Id};
}

// In-process pub/sub for collection writes that replaces a MongoDB change-stream watch.
// ClassCommander rebroadcasts dispatch() to every replica so a write on one instance reaches
// the watchers on all instances. Subclass per collection so ClassCommander, which routes by
// ctx.constructor.name, keeps each collection's broadcasts isolated.
@Injectable()
export abstract class CollectionChangeDispatcher<
  E extends CollectionChangeEvent = CollectionChangeEvent
> implements OnModuleDestroy {
  private readonly changes = new Subject<E>();
  private commanderSubscription?: {unsubscribe: () => void};

  constructor(@Optional() commander?: ClassCommander) {
    if (commander) {
      this.commanderSubscription = commander.register(this, [this.dispatch], CommandType.SYNC);
    }
  }

  dispatch(change: E) {
    this.changes.next(change);
  }

  watch(): Observable<E> {
    return this.changes.asObservable();
  }

  onModuleDestroy() {
    if (this.commanderSubscription) {
      this.commanderSubscription.unsubscribe();
    }
    this.changes.complete();
  }
}
