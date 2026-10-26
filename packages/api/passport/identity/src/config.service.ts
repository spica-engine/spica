import {Injectable} from "@nestjs/common";
import {ConfigChangeDispatcher, ConfigService} from "@spica-server/config";
import {DatabaseService} from "@spica-server/database";
import {IdentityConfigSettings} from "@spica-server/interface-passport-identity";
import {map} from "rxjs/operators";

@Injectable()
export class IdentityConfigService extends ConfigService {
  private readonly MODULE_NAME = "identity";

  constructor(db: DatabaseService, changeDispatcher: ConfigChangeDispatcher) {
    super(db, changeDispatcher);
  }

  async set(config: IdentityConfigSettings): Promise<void> {
    await this.updateOne(
      {module: this.MODULE_NAME},
      {
        $set: {
          module: this.MODULE_NAME,
          options: {
            ...config
          }
        }
      },
      {upsert: true}
    );
  }

  get() {
    return this.findOne({
      module: this.MODULE_NAME
    });
  }

  watchConfig() {
    return this.watchModule(this.MODULE_NAME).pipe(
      map(change => (change.options as IdentityConfigSettings) || {})
    );
  }
}
