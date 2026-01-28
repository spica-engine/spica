import {Injectable} from "@nestjs/common";
import {ConfigService} from "@spica-server/config";
import {DatabaseService} from "@spica-server/database";
import {UserConfigSettings} from "@spica-server/interface/passport/user";

@Injectable()
export class UserConfigService extends ConfigService {
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
}
