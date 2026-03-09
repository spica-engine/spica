import {Injectable} from "@nestjs/common";
import {ConfigService} from "@spica-server/config";
import {DatabaseService} from "@spica-server/database";
import {BaseConfig} from "@spica-server/interface/config";
import {UserConfigSettings, RateLimitConfig} from "@spica-server/interface/passport/user";
import {filter, map} from "rxjs/operators";

@Injectable()
export class UserConfigService extends ConfigService {
  private readonly MODULE_NAME = "user";
  constructor(db: DatabaseService) {
    super(db);
  }

  async set(config: UserConfigSettings): Promise<void> {
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

  async getPasswordlessLoginConfig(): Promise<UserConfigSettings["passwordlessLogin"]> {
    const config = (await this.findOne({
      module: this.MODULE_NAME
    })) as BaseConfig<UserConfigSettings>;

    return config?.options?.passwordlessLogin;
  }

  async updatePasswordlessLoginConfig(
    passwordlessLogin: UserConfigSettings["passwordlessLogin"]
  ): Promise<void> {
    await this.updateOne(
      {module: this.MODULE_NAME},
      {
        $set: {
          "options.passwordlessLogin": passwordlessLogin
        }
      },
      {upsert: true}
    );
  }

  async getResetPasswordConfig(): Promise<UserConfigSettings["resetPasswordProvider"]> {
    const config = (await this.findOne({
      module: this.MODULE_NAME
    })) as BaseConfig<UserConfigSettings>;

    return config?.options?.resetPasswordProvider;
  }

  async updateResetPasswordConfig(
    resetPasswordProvider: UserConfigSettings["resetPasswordProvider"]
  ): Promise<void> {
    await this.updateOne(
      {module: this.MODULE_NAME},
      {
        $set: {
          "options.resetPasswordProvider": resetPasswordProvider
        }
      },
      {upsert: true}
    );
  }

  async getProviderVerificationConfig(): Promise<UserConfigSettings["providerVerificationConfig"]> {
    const config = (await this.findOne({
      module: this.MODULE_NAME
    })) as BaseConfig<UserConfigSettings>;

    return config?.options?.providerVerificationConfig;
  }

  async updateProviderVerificationConfig(
    providerVerificationConfig: UserConfigSettings["providerVerificationConfig"]
  ): Promise<void> {
    await this.updateOne(
      {module: this.MODULE_NAME},
      {
        $set: {
          "options.providerVerificationConfig": providerVerificationConfig
        }
      },
      {upsert: true}
    );
  }

  async getRateLimitConfig(): Promise<RateLimitConfig | undefined> {
    const config = (await this.findOne({
      module: this.MODULE_NAME
    })) as BaseConfig<UserConfigSettings>;

    return config?.options?.rateLimits;
  }

  watchConfig() {
    return this.watch([], {fullDocument: "updateLookup"}).pipe(
      filter(change => (change as any).fullDocument?.module === this.MODULE_NAME),
      map(
        change =>
          ((change as any).fullDocument?.options as UserConfigSettings) ||
          ({} as Partial<UserConfigSettings>)
      )
    );
  }
}
