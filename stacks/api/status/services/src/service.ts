import {BaseCollection, DatabaseService} from "@spica-server/database";
import {Inject, Injectable} from "@nestjs/common";
import {ApiStatus, StatusOptions, STATUS_OPTIONS} from "./interface";

@Injectable()
export class StatusService extends BaseCollection<ApiStatus>("status") {
  constructor(db: DatabaseService, @Inject(STATUS_OPTIONS) options: StatusOptions) {
    super(db);
  }

  increase(resource: "request" | "response", size: number) {
    const update = {
      $inc: {
        [`${resource}.count`]: 1
      }
    };

    if (size) {
      update.$inc[`${resource}.size`] = size;
    }

    return super.findOneAndUpdate({}, update, {upsert: true});
  }
}
