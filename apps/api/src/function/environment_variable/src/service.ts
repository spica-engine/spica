import {Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService} from "@spica-server/database";
import {EnvironmentVariable} from "@spica-server/function/environment_variable/src/interface";

@Injectable()
export class EnvironmentVariableService extends BaseCollection<EnvironmentVariable>(
  "environment_variables"
) {
  constructor(db: DatabaseService) {
    super(db);
  }
}
