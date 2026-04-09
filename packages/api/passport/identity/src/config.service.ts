import {Injectable} from "@nestjs/common";
import {ConfigService} from "@spica-server/config";
import {DatabaseService} from "@spica-server/database";
import {BaseConfig} from "@spica-server/interface-config";
import {IdentityConfigSettings} from "@spica-server/interface-passport-identity";
import {filter, map} from "rxjs/operators";

@Injectable()
export class IdentityConfigService extends ConfigService {
  private readonly MODULE_NAME = "identity";

  constructor(db: DatabaseService) {
    super(db);
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
    return this.watch([], {fullDocument: "updateLookup"}).pipe(
      filter(change => (change as any).fullDocument?.module === this.MODULE_NAME),
      map(change => ((change as any).fullDocument?.options as IdentityConfigSettings) || {})
    );
  }
}
