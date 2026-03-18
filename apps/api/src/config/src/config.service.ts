import {Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService} from "@spica-server/database";
import {BaseConfig} from "@spica-server/interface/config";

@Injectable()
export class ConfigService extends BaseCollection<BaseConfig>("config") {
  constructor(db: DatabaseService) {
    super(db);
  }
}
