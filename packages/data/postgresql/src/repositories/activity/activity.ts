import {Inject, Injectable} from "@nestjs/common";
import {Orm} from "@spica-server/data-postgresql-orm";
import {Id} from "@spica-server/interface-data";
import {Activity, ActivityRepository} from "@spica-server/interface-activity";
import {activities} from "../../entities/index.js";
import {ORM} from "../../orm.js";

@Injectable()
export class PostgresActivityRepository implements ActivityRepository {
  constructor(@Inject(ORM) private readonly orm: Orm) {}

  async insertMany(items: Activity[]) {
    const inserted = await this.orm.insertMany(activities, items);
    return inserted.map(activity => activity._id);
  }

  async deleteById(id: Id) {
    return (await this.orm.deleteById(activities, id)) ? 1 : 0;
  }

  async deleteByIds(ids: Id[]) {
    return await this.orm.deleteWhere(activities, {_id: ids});
  }
}
