import {Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService} from "../../../../../../libs/database";
import {ApiKey} from "../../../../../../libs/interface/passport/apikey";

@Injectable()
export class ApiKeyService extends BaseCollection<ApiKey>("apikey") {
  constructor(db: DatabaseService) {
    super(db, {
      afterInit: () => this._coll.createIndex({key: 1}, {unique: true})
    });
  }
}
