import {Injectable, OnModuleDestroy, Optional} from "@nestjs/common";
import {Observable, Subject} from "rxjs";
import {ObjectId} from "@spica-server/database";
import {CommandType} from "@spica-server/interface-replication";
import {ClassCommander} from "./commander.js";

export interface CollectionChangeEvent {
  operationType: "insert" | "update" | "replace" | "delete";
  documentKey: {_id: ObjectId};
}

// In-process pub/sub for collection writes that replaces a MongoDB change-stream watch.
// ClassCommander rebroadcasts dispatch() to every replica so a write on one instance reaches
// the watchers on all instances. Subclass per collection so ClassCommander, which routes by
// ctx.constructor.name, keeps each collection's broadcasts isolated.
@Injectable()
export abstract class CollectionChangeDispatcher implements OnModuleDestroy {
  private readonly changes = new Subject<CollectionChangeEvent>();
  private commanderSubscription?: {unsubscribe: () => void};

  constructor(@Optional() commander?: ClassCommander) {
    if (commander) {
      this.commanderSubscription = commander.register(this, [this.dispatch], CommandType.SYNC);
    }
  }

  dispatch(change: CollectionChangeEvent) {
    this.changes.next(change);
  }

  watch(): Observable<CollectionChangeEvent> {
    return this.changes.asObservable();
  }

  onModuleDestroy() {
    if (this.commanderSubscription) {
      this.commanderSubscription.unsubscribe();
    }
    this.changes.complete();
  }
}
