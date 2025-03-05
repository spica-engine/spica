import {Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService} from "@spica-server/database";
import {EnvVar} from "@spica-server/interface/env_var";

@Injectable()
export class EnvVarsService extends BaseCollection<EnvVar>("env_var") {
  constructor(db: DatabaseService) {
    super(db);
  }
}
