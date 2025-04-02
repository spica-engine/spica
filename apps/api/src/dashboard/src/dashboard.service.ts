import {Injectable} from "@nestjs/common";
import {Dashboard} from "@spica-server/interface/dashboard";
import {BaseCollection, DatabaseService} from "@spica-server/database";

@Injectable()
export class DashboardService extends BaseCollection<Dashboard>("dashboard") {
  constructor(db: DatabaseService) {
    super(db);
  }
}
