import {Injectable} from "@nestjs/common";
import {Dashboard} from "../../../../../libs/interface/dashboard";
import {BaseCollection, DatabaseService} from "../../../../../libs/database";

@Injectable()
export class DashboardService extends BaseCollection<Dashboard>("dashboard") {
  constructor(db: DatabaseService) {
    super(db);
  }
}
