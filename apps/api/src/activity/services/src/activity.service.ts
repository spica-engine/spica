import {BaseCollection, DatabaseService, ObjectId} from "@spica-server/database";
import {
  Activity,
  ACTIVITY_OPTIONS,
  ActivityOptions,
  ModuleActivity
} from "@spica-server/interface/activity";
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

      if (ObjectId.isValid(activity.username)) {
        activity.username = new ObjectId(activity.username);
      }

      activity.created_at = new Date();

      return activity;
    });

    return this.insertMany(preparedActivities);
  }
}
