import {Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService} from "../../../../../../../libs/database";
import {Strategy} from "../../../../../../../libs/interface/passport";

@Injectable()
export class StrategyService extends BaseCollection<Strategy>("strategy") {
  constructor(database: DatabaseService) {
    super(database);
  }
}
