import {Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService, ReturnDocument} from "@spica-server/database";
import {Id} from "@spica-server/interface-data";
import {Dashboard, DashboardRepository} from "@spica-server/interface-dashboard";

@Injectable()
export class MongoDashboardRepository
  extends BaseCollection<Dashboard>("dashboard")
  implements DashboardRepository
{
  constructor(db: DatabaseService) {
    super(db);
  }

  findAll() {
    return this.find();
  }

  findById(id: Id) {
    return this.findOne({_id: id});
  }

  insert(dashboard: Dashboard) {
    return this.insertOne(dashboard);
  }

  replaceById(id: Id, dashboard: Dashboard) {
    return this.findOneAndReplace({_id: id}, dashboard, {returnDocument: ReturnDocument.AFTER});
  }

  deleteById(id: Id) {
    return this.findOneAndDelete({_id: id});
  }
}
