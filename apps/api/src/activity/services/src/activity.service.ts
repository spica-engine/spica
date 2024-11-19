import {BaseCollection, DatabaseService, ObjectId} from "@spica/database";
import {Activity, ACTIVITY_OPTIONS, ActivityOptions, ModuleActivity} from "./interface";
import {Injectable, Inject} from "@nestjs/common";

@Injectable()
export class ActivityService extends BaseCollection<Activity>("activity") {
  constructor(db: DatabaseService, @Inject(ACTIVITY_OPTIONS) options: ActivityOptions) {
    super(db, {afterInit: () => this.upsertTTLIndex(options.expireAfterSeconds)});
  }

  insert(activities: ModuleActivity[]) {
    const preparedActivities = activities.map((activity: Activity) => {
      if (ObjectId.isValid(activity.identifier)) {
        activity.identifier = new ObjectId(activity.identifier);
      }

      activity.created_at = new Date();

      return activity;
    });

    return this.insertMany(preparedActivities);
  }
}
