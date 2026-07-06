import {Injectable, OnModuleDestroy, Optional} from "@nestjs/common";
import {Observable, Subject} from "rxjs";
import {filter} from "rxjs/operators";
import {BaseConfig} from "@spica-server/interface-config";
import {ClassCommander} from "@spica-server/replication";
import {CommandType} from "@spica-server/interface-replication";

@Injectable()
export class ConfigChangeDispatcher implements OnModuleDestroy {
  private readonly changes = new Subject<BaseConfig>();
  private commanderSubscription?: {unsubscribe: () => void};

  // ClassCommander rebroadcasts dispatch() to every replica so a config write on one
  // instance reaches the watchers on all instances, replacing the previous change-stream watch.
  constructor(@Optional() commander?: ClassCommander) {
    if (commander) {
      this.commanderSubscription = commander.register(this, [this.dispatch], CommandType.SYNC);
    }
  }

  dispatch(config: BaseConfig) {
    this.changes.next(config);
  }

  watch(module: string): Observable<BaseConfig> {
    return this.changes.pipe(filter(change => !!change && change.module === module));
  }

  onModuleDestroy() {
    if (this.commanderSubscription) {
      this.commanderSubscription.unsubscribe();
    }
    this.changes.complete();
  }
}
