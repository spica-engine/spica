import {Inject, Injectable} from "@nestjs/common";
import {BaseConfig, CONFIG_REPOSITORY, ConfigRepository} from "@spica-server/interface-config";
import {Observable} from "rxjs";
import {ConfigChangeDispatcher} from "./config.change-dispatcher.js";

@Injectable()
export class ConfigService {
  constructor(
    @Inject(CONFIG_REPOSITORY) private readonly configs: ConfigRepository,
    private readonly changeDispatcher: ConfigChangeDispatcher
  ) {}

  findByModule(module: string): Promise<BaseConfig | null> {
    return this.configs.findByModule(module);
  }

  async replace(module: string, config: BaseConfig): Promise<BaseConfig> {
    const result = await this.configs.replaceByModule(module, config);
    if (result) {
      this.changeDispatcher.dispatch({module: result.module, options: result.options});
    }
    return result;
  }

  async setOptions(module: string, options: object): Promise<void> {
    await this.configs.setOptions(module, options);
    await this.dispatchChange(module);
  }

  async setOption(module: string, name: string, value: unknown): Promise<void> {
    await this.configs.setOption(module, name, value);
    await this.dispatchChange(module);
  }

  protected watchModule(module: string): Observable<BaseConfig> {
    return this.changeDispatcher.watch(module);
  }

  // Read-after-write so the dispatched snapshot reflects the persisted document. A concurrent
  // write to the same module could be reflected instead, but config writes are rare admin
  // actions where that race is acceptable, and reconstructing the payload from update operators
  // would be far more fragile.
  private async dispatchChange(module: string): Promise<void> {
    const config = await this.configs.findByModule(module);
    if (config) {
      this.changeDispatcher.dispatch({module: config.module, options: config.options});
    }
  }
}
