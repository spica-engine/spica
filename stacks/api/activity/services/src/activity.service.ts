import {BaseCollection, DatabaseService} from "@spica-server/database";
import {Activity, ACTIVITY_OPTIONS, ActivityOptions} from "./interface";
import {Injectable, Inject} from "@nestjs/common";

const COLLECTION_NAME = "activity";

@Injectable()
export class ActivityService extends BaseCollection<Activity>(COLLECTION_NAME) {
  constructor(db: DatabaseService, @Inject(ACTIVITY_OPTIONS) options: ActivityOptions) {
    super(db);
    this.createCollection(COLLECTION_NAME)
      .then(() => this.upsertTTLIndex(options.expireAfterSeconds))
      .catch(error => console.error(`Could not create TTL indexes.`, error));
  }
}
