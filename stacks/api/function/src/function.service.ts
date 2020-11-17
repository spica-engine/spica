import {Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService} from "@spica-server/database";
import {Function} from "./interface";

@Injectable()
export class FunctionService extends BaseCollection<Function>("function") {
  constructor(database: DatabaseService) {
    super(database);
  }
}
