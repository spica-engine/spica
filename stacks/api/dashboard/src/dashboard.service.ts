import {Injectable} from "@nestjs/common";
import {Dashboard} from "./dashboard";
import {BaseCollection, DatabaseService, MongoClient} from "@spica-server/database";

@Injectable()
export class DashboardService extends BaseCollection<Dashboard>("dashboard") {
  constructor(db: DatabaseService,client:MongoClient) {
    super(db,client);
  }
}
