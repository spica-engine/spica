import {Inject, Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService} from "@spica-server/database";
import {Secret} from "@spica-server/interface-secret";

export const SECRET_ENCRYPTION_SECRET = Symbol.for("SECRET_ENCRYPTION_SECRET");

@Injectable()
export class SecretService extends BaseCollection<Secret>("secret") {
  constructor(
    db: DatabaseService,
    @Inject(SECRET_ENCRYPTION_SECRET) public readonly encryptionSecret: string
  ) {
    super(db, {
      afterInit: () => this._coll.createIndex({key: 1}, {unique: true}),
      collectionOptions: {changeStreamPreAndPostImages: {enabled: true}}
    });
  }
}
