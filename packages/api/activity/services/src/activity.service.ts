import {BaseCollection, DatabaseService} from "@spica-server/database";
import {
  Activity,
  ACTIVITY_OPTIONS,
  ActivityOptions,
  ModuleActivity
} from "@spica-server/interface-activity";
import {Injectable, Inject} from "@nestjs/common";
import {ids} from "@spica-server/data";

const identityIds = () => ids().forCollection("identity");

@Injectable()
export class ActivityService extends BaseCollection<Activity>("activity") {
  constructor(db: DatabaseService, @Inject(ACTIVITY_OPTIONS) options: ActivityOptions) {
    super(db, {afterInit: () => this.upsertTTLIndex(options.expireAfterSeconds)});
  }

  insert(activities: ModuleActivity[]) {
    const preparedActivities = activities.map((activity: Activity) => {
      if (identityIds().isValid(activity.identifier)) {
        activity.identifier = identityIds().parse(activity.identifier);
      }

      if (identityIds().isValid(activity.username)) {
        activity.username = identityIds().parse(activity.username);
      }

      activity.created_at = new Date();

      return activity;
    });

    return this.insertMany(preparedActivities);
  }
}
