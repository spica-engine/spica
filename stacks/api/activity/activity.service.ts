import {BaseCollection, DatabaseService} from "@spica-server/database";
import {Activity} from "./interface";
import {Injectable} from "@nestjs/common";

@Injectable()
export class ActivityService extends BaseCollection<Activity>("activity") {
  constructor(db: DatabaseService) {
    super(db);
  }
}
