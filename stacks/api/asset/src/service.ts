import {Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService} from "@spica-server/database";
import {Asset} from "@spica-server/interface/asset";

@Injectable()
export class AssetService extends BaseCollection<Asset>("asset") {
  constructor(db: DatabaseService) {
    super(db);
  }
}
