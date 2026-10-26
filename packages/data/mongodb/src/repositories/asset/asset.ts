import {Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService} from "@spica-server/database";
import {Id} from "@spica-server/interface-data";
import {Asset, AssetRepository} from "@spica-server/interface-asset";

@Injectable()
export class MongoAssetRepository
  extends BaseCollection<Asset>("asset")
  implements AssetRepository
{
  constructor(db: DatabaseService) {
    super(db);
  }

  findById(id: Id) {
    return this.findOne({_id: id});
  }

  findVersions(url: string) {
    return this.find({url});
  }

  insert(asset: Asset) {
    return this.insertOne(asset);
  }

  replaceById(id: Id, asset: Asset) {
    return this.findOneAndReplace({_id: id}, asset);
  }

  updateById(id: Id, fields: Partial<Asset>) {
    return this.findOneAndUpdate({_id: id}, {$set: fields});
  }

  deleteById(id: Id) {
    return this.findOneAndDelete({_id: id});
  }
}
