import {Injectable, OnModuleDestroy, Optional} from "@nestjs/common";
import {Observable, Subject} from "rxjs";
import {ObjectId} from "@spica-server/database";
import {ClassCommander} from "@spica-server/replication";
import {CommandType} from "@spica-server/interface-replication";

export interface CollectionChangeEvent {
  operationType: "insert" | "update" | "replace" | "delete";
  documentKey: {_id: ObjectId};
}

@Injectable()
export class SecretChangeDispatcher implements OnModuleDestroy {
  private readonly changes = new Subject<CollectionChangeEvent>();
  private commanderSubscription?: {unsubscribe: () => void};

  // ClassCommander rebroadcasts dispatch() to every replica so a secret write on one instance
  // reaches the watchers on all instances, replacing the previous change-stream watch. A distinct
  // class name per collection keeps env-var and secret broadcasts isolated (ClassCommander routes
  // by ctx.constructor.name).
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
