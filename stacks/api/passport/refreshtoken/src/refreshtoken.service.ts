import {Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService} from "@spica-server/database";
import {RefreshToken} from "./interface";

@Injectable()
export class RefreshTokenService extends BaseCollection<RefreshToken>("refreshtoken") {
  constructor(db: DatabaseService) {
    super(db, {
      afterInit: () => this._coll.createIndex({token: 1}, {unique: true})
    });
  }
}
