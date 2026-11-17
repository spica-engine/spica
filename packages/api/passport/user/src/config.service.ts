import {Inject, Injectable} from "@nestjs/common";
import {ConfigChangeDispatcher, ConfigService} from "@spica-server/config";
import {BaseConfig, CONFIG_REPOSITORY, ConfigRepository} from "@spica-server/interface-config";
import {UserConfigSettings, RateLimitConfig} from "@spica-server/interface-passport-user";
import {map} from "rxjs/operators";

@Injectable()
export class UserConfigService extends ConfigService {
  private readonly MODULE_NAME = "user";
  constructor(
    @Inject(CONFIG_REPOSITORY) configs: ConfigRepository,
    changeDispatcher: ConfigChangeDispatcher
  ) {
    super(configs, changeDispatcher);
  }

  async set(config: UserConfigSettings): Promise<void> {
    await this.setOptions(this.MODULE_NAME, {...config});
  }
  get() {
    return this.findByModule(this.MODULE_NAME);
  }

  async getPasswordlessLoginConfig(): Promise<UserConfigSettings["passwordlessLogin"]> {
    const config = (await this.findByModule(this.MODULE_NAME)) as BaseConfig<UserConfigSettings>;

    return config?.options?.passwordlessLogin;
  }

  async updatePasswordlessLoginConfig(
    passwordlessLogin: UserConfigSettings["passwordlessLogin"]
  ): Promise<void> {
    await this.setOption(this.MODULE_NAME, "passwordlessLogin", passwordlessLogin);
  }

  async getResetPasswordConfig(): Promise<UserConfigSettings["resetPasswordProvider"]> {
    const config = (await this.findByModule(this.MODULE_NAME)) as BaseConfig<UserConfigSettings>;

    return config?.options?.resetPasswordProvider;
  }

  async updateResetPasswordConfig(
    resetPasswordProvider: UserConfigSettings["resetPasswordProvider"]
  ): Promise<void> {
    await this.setOption(this.MODULE_NAME, "resetPasswordProvider", resetPasswordProvider);
  }

  async getProviderVerificationConfig(): Promise<UserConfigSettings["providerVerificationConfig"]> {
    const config = (await this.findByModule(this.MODULE_NAME)) as BaseConfig<UserConfigSettings>;

    return config?.options?.providerVerificationConfig;
  }

  async updateProviderVerificationConfig(
    providerVerificationConfig: UserConfigSettings["providerVerificationConfig"]
  ): Promise<void> {
    await this.setOption(
      this.MODULE_NAME,
      "providerVerificationConfig",
      providerVerificationConfig
    );
  }

  async getRateLimitConfig(): Promise<RateLimitConfig | undefined> {
    const config = (await this.findByModule(this.MODULE_NAME)) as BaseConfig<UserConfigSettings>;

    return config?.options?.rateLimits;
  }

  watchConfig() {
    return this.watchModule(this.MODULE_NAME).pipe(
      map(change => (change.options as UserConfigSettings) || ({} as Partial<UserConfigSettings>))
    );
  }
}
