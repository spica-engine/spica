import {Injectable, Logger, OnModuleDestroy, OnModuleInit} from "@nestjs/common";
import {ConfigService} from "@spica-server/config";
import {DatabaseService} from "@spica-server/database";
import {BaseConfig} from "@spica-server/interface/config";
import {AutoApproveSyncConfig, VCConfigSettings} from "@spica-server/interface/versioncontrol";
import {Observable, Subject, defer, firstValueFrom, merge, of} from "rxjs";
import {map, shareReplay, takeUntil, timeout} from "rxjs/operators";

const DEFAULT_AUTO_APPROVE_SYNC: AutoApproveSyncConfig = {
  document: false,
  representative: false
};

const MODULE_NAME = "versioncontrol";

@Injectable()
export class VCConfigService extends ConfigService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VCConfigService.name);
  private autoApproveSyncConfig$: Observable<AutoApproveSyncConfig>;
  private onDestroySubject = new Subject<void>();

  constructor(db: DatabaseService) {
    super(db);
  }

  onModuleInit() {
    const initial$ = defer(() =>
      this.findOne({module: MODULE_NAME}).then(config => {
        const settings = config?.options as VCConfigSettings;
        return settings?.autoApproveSync || DEFAULT_AUTO_APPROVE_SYNC;
      })
    );

    const changes$ = this.watch([{$match: {"fullDocument.module": MODULE_NAME}}], {
      fullDocument: "updateLookup"
    }).pipe(
      map(change => {
        const settings = (change as any).fullDocument?.options as VCConfigSettings;
        return settings?.autoApproveSync || DEFAULT_AUTO_APPROVE_SYNC;
      })
    );

    this.autoApproveSyncConfig$ = merge(initial$, changes$).pipe(
      takeUntil(this.onDestroySubject),
      shareReplay(1)
    );
  }

  onModuleDestroy() {
    this.onDestroySubject.next();
    this.onDestroySubject.complete();
  }

  async getAutoApproveSyncConfig(): Promise<AutoApproveSyncConfig> {
    return firstValueFrom(
      this.autoApproveSyncConfig$.pipe(
        timeout({
          first: 5000,
          with: () => {
            this.logger.warn(
              "Auto-approve config did not emit within 5s — falling back to default (all disabled)."
            );
            return of(DEFAULT_AUTO_APPROVE_SYNC);
          }
        })
      )
    );
  }

  async set(config: VCConfigSettings): Promise<void> {
    await this.updateOne(
      {module: MODULE_NAME},
      {
        $set: {
          module: MODULE_NAME,
          options: {...config}
        }
      },
      {upsert: true}
    );
  }

  get(): Promise<BaseConfig<VCConfigSettings> | undefined> {
    return this.findOne({module: MODULE_NAME}) as Promise<BaseConfig<VCConfigSettings> | undefined>;
  }
}
