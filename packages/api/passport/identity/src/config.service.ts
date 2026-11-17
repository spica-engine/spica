import {Inject, Injectable} from "@nestjs/common";
import {ConfigChangeDispatcher, ConfigService} from "@spica-server/config";
import {CONFIG_REPOSITORY, ConfigRepository} from "@spica-server/interface-config";
import {IdentityConfigSettings} from "@spica-server/interface-passport-identity";
import {map} from "rxjs/operators";

@Injectable()
export class IdentityConfigService extends ConfigService {
  private readonly MODULE_NAME = "identity";

  constructor(
    @Inject(CONFIG_REPOSITORY) configs: ConfigRepository,
    changeDispatcher: ConfigChangeDispatcher
  ) {
    super(configs, changeDispatcher);
  }

  async set(config: IdentityConfigSettings): Promise<void> {
    await this.setOptions(this.MODULE_NAME, {...config});
  }

  get() {
    return this.findByModule(this.MODULE_NAME);
  }

  watchConfig() {
    return this.watchModule(this.MODULE_NAME).pipe(
      map(change => (change.options as IdentityConfigSettings) || {})
    );
  }
}
