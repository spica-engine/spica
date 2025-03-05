import {Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService} from "@spica-server/database";
import {EnvVar} from "@spica-server/interface/env_vars";

@Injectable()
export class EnvVarsService extends BaseCollection<EnvVar>("env_vars") {
  constructor(db: DatabaseService) {
    super(db);
  }
}
