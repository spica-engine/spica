import {Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService, MongoClient, ObjectId} from "@spica-server/database";
import {Asset} from "@spica-server/interface/asset";
import {Observable} from "rxjs";

@Injectable()
export class AssetService extends BaseCollection<Asset>("asset") {
  constructor(db: DatabaseService, client: MongoClient) {
    super(db, client);
  }

  watch() {
    return new Observable<Asset[]>(observer => {
      const emitAssets = () => this.find().then(assets => observer.next(assets));

      emitAssets();

      const stream = this._coll.watch([], {fullDocument: "updateLookup"});
      stream.on("change", () => emitAssets());

      return () => {
        if (!stream.isClosed()) {
          stream.close();
        }
      };
    });
  }
}
