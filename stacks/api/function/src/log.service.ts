import {Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService, ObjectId} from "@spica-server/database";

@Injectable()
export class LogService extends BaseCollection<Log>("function_logs") {
  constructor(db: DatabaseService) {
    super(db);
  }
}

export interface Log {
  _id: ObjectId;
  function: string;
  event_id: string;
  content: string;
}
