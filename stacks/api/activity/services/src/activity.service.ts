import {BaseCollection, DatabaseService} from "@spica-server/database";
import {Activity, ACTIVITY_OPTIONS, ActivityOptions} from "./interface";
import {Injectable, Inject} from "@nestjs/common";

@Injectable()
export class ActivityService extends BaseCollection<Activity>("activity") {
  constructor(db: DatabaseService, @Inject(ACTIVITY_OPTIONS) options: ActivityOptions) {
    super(db);
    this.createCollection(this._collection, {ignoreAlreadyExist: true}).then(() =>
      this.upsertTTLIndex(options.expireAfterSeconds)
    );
  }
}
