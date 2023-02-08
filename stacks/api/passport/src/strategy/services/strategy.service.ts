import {Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService, MongoClient} from "@spica-server/database";
import {Strategy} from "../interface";

@Injectable()
export class StrategyService extends BaseCollection<Strategy>("strategy") {
  constructor(database: DatabaseService, client: MongoClient) {
    super(database, client);
  }
}
