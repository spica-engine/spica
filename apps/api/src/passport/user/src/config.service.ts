import {Injectable} from "@nestjs/common";
import {ConfigService} from "@spica-server/config";
import {DatabaseService} from "@spica-server/database";
import {BaseConfig} from "@spica-server/interface/config";
import {UserConfigSettings} from "@spica-server/interface/passport/user";

@Injectable()
export class UserConfigService extends ConfigService {
  private readonly MODULE_NAME = "User";
  constructor(db: DatabaseService) {
    super(db);
  }

  async set(config: UserConfigSettings): Promise<void> {
    await this.updateOne(
      {module: "User"},
      {
        $set: {
          module: "User",
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
      module: "User"
    });
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
}
