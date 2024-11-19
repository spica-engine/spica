import {Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService} from "@spica/database";
import {Strategy} from "../interface";

@Injectable()
export class StrategyService extends BaseCollection<Strategy>("strategy") {
  constructor(database: DatabaseService) {
    super(database);
  }
}
