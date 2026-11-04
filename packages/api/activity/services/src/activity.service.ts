import {
  Activity,
  ACTIVITY_REPOSITORY,
  ActivityRepository,
  ModuleActivity
} from "@spica-server/interface-activity";
import {Injectable, Inject} from "@nestjs/common";
import {ids} from "@spica-server/data";
import {Id} from "@spica-server/interface-data";

const identityIds = () => ids().forCollection("identity");

@Injectable()
export class ActivityService {
  constructor(@Inject(ACTIVITY_REPOSITORY) private activities: ActivityRepository) {}

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

    return this.activities.insertMany(preparedActivities);
  }

  deleteById(id: Id) {
    return this.activities.deleteById(id);
  }

  deleteByIds(ids: Id[]) {
    return this.activities.deleteByIds(ids);
  }
}
