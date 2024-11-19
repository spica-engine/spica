import {Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService} from "@spica/database";
import {ApiKey} from "./interface";

@Injectable()
export class ApiKeyService extends BaseCollection<ApiKey>("apikey") {
  constructor(db: DatabaseService) {
    super(db, {
      afterInit: () => this._coll.createIndex({key: 1}, {unique: true})
    });
  }
}
