import {Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService} from "@spica-server/database";
import {BlacklistedToken} from "./interface";

@Injectable()
export class BlacklistedTokenService extends BaseCollection<BlacklistedToken>("blacklistedtoken") {
  constructor(db: DatabaseService) {
    super(db, {
      afterInit: () => this._coll.createIndex({token: 1}, {unique: true})
    });
  }
}
