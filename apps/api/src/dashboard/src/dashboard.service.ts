import {Injectable} from "@nestjs/common";
import {Dashboard} from "./dashboard";
import {BaseCollection, DatabaseService} from "@spica/database";

@Injectable()
export class DashboardService extends BaseCollection<Dashboard>("dashboard") {
  constructor(db: DatabaseService) {
    super(db);
  }
}
