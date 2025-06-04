import {Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService} from "@spica-server/database";
import {RefreshToken} from "@spica-server/interface/passport/refresh_token";

@Injectable()
export class RefreshTokenService extends BaseCollection<RefreshToken>("refresh_token") {
  constructor(db: DatabaseService) {
    super(db, {
      afterInit: () =>
        Promise.all([
          this._coll.createIndex({token: 1}, {unique: true}),
          this._coll.createIndex({expired_at: 1}, {expireAfterSeconds: 0})
        ])
    });
  }
}
