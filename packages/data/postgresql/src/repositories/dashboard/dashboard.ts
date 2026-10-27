import {Inject, Injectable} from "@nestjs/common";
import {Orm} from "@spica-server/data-postgresql-orm";
import {Dashboard, DashboardRepository} from "@spica-server/interface-dashboard";
import {Id} from "@spica-server/interface-data";
import {dashboards} from "../../entities/index.js";
import {ORM} from "../../orm.js";

@Injectable()
export class PostgresDashboardRepository implements DashboardRepository {
  constructor(@Inject(ORM) private readonly orm: Orm) {}

  findAll() {
    return this.orm.findMany(dashboards, {}, {orderBy: {_id: "asc"}});
  }

  findById(id: Id) {
    return this.orm.findById(dashboards, id);
  }

  insert(dashboard: Dashboard) {
    return this.orm.insert(dashboards, dashboard);
  }

  replaceById(id: Id, dashboard: Dashboard) {
    return this.orm.replaceById(dashboards, id, dashboard);
  }

  deleteById(id: Id) {
    return this.orm.deleteById(dashboards, id);
  }
}
