import {Inject, Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService} from "@spica-server/database";
import {Id} from "@spica-server/interface-data";
import {
  Activity,
  ACTIVITY_OPTIONS,
  ActivityOptions,
  ActivityRepository
} from "@spica-server/interface-activity";

@Injectable()
export class MongoActivityRepository
  extends BaseCollection<Activity>("activity")
  implements ActivityRepository
{
  constructor(db: DatabaseService, @Inject(ACTIVITY_OPTIONS) options: ActivityOptions) {
    super(db, {afterInit: () => this.upsertTTLIndex(options.expireAfterSeconds)});
  }

  deleteById(id: Id) {
    return this.deleteOne({_id: id});
  }

  deleteByIds(ids: Id[]) {
    return this.deleteMany({_id: {$in: ids}});
  }
}
