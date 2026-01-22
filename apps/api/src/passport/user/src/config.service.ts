import {Injectable} from "@nestjs/common";
import {ConfigService} from "@spica-server/config";
import {DatabaseService} from "@spica-server/database";
import {UserConfigSettings} from "@spica-server/interface/passport/user";

@Injectable()
export class UserConfigService extends ConfigService {
  constructor(db: DatabaseService) {
    super(db);
  }

  setUserConfig(config: UserConfigSettings): void {
    this.insertOne({
      module: "User",
      options: {
        ...config
      }
    });
  }
  getUserConfig() {
    return this.findOne({
      module: "User"
    });
  }
}
