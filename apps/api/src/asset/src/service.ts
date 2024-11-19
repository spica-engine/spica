import {Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService, ObjectId} from "@spica/database";
import {Asset} from "@spica/interface";
import {Observable} from "rxjs";

@Injectable()
export class AssetService extends BaseCollection<Asset>("asset") {
  constructor(db: DatabaseService) {
    super(db);
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
