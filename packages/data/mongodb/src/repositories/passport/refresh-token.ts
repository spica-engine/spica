import {Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService, ReturnDocument} from "@spica-server/database";
import {Id} from "@spica-server/interface-data";
import {RefreshToken, RefreshTokenRepository} from "@spica-server/interface-passport-refresh_token";

@Injectable()
export class MongoRefreshTokenRepository
  extends BaseCollection<RefreshToken>("refresh_token")
  implements RefreshTokenRepository
{
  constructor(db: DatabaseService) {
    super(db, {
      afterInit: () =>
        Promise.all([
          this._coll.createIndex({token: 1}, {unique: true}),
          this._coll.createIndex({expired_at: 1}, {expireAfterSeconds: 0})
        ])
    });
  }

  insert(token: RefreshToken) {
    return this.insertOne(token);
  }

  findByToken(token: string) {
    return this.findOne({token});
  }

  markUsed(token: string, at: Date) {
    return this.updateOne({token}, {$set: {last_used_at: at}});
  }

  setDisabled(id: Id, disabled: boolean) {
    return this.findOneAndUpdate(
      {_id: id},
      {$set: {disabled}},
      {returnDocument: ReturnDocument.AFTER, projection: {token: 0}}
    );
  }

  deleteById(id: Id) {
    return this.deleteOne({_id: id});
  }
}
