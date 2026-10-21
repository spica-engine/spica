import {Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService, WithId} from "@spica-server/database";
import {Id} from "@spica-server/interface-data";
import {FunctionAsset, FunctionAssetFilename} from "@spica-server/interface-function-asset-storage";

const collectionName = "function_assets";

@Injectable()
export class FunctionAssetService extends BaseCollection<FunctionAsset>(collectionName) {
  constructor(database: DatabaseService) {
    super(database, {
      collectionOptions: {changeStreamPreAndPostImages: {enabled: true}},
      afterInit: () =>
        Promise.all([
          this.createIndex({functionId: 1, filename: 1}, {unique: true}),
          this.createIndex({functionId: 1})
        ])
    });
  }

  findByFunction(functionId: Id): Promise<WithId<FunctionAsset>[]> {
    return this.find({functionId});
  }

  findByFilename(
    functionId: Id,
    filename: FunctionAssetFilename
  ): Promise<WithId<FunctionAsset> | null> {
    return this.findOne({functionId, filename});
  }

  async upsertAsset(
    functionId: Id,
    filename: FunctionAssetFilename,
    fields: Omit<FunctionAsset, "functionId" | "filename" | "_id">
  ): Promise<void> {
    await this._coll.updateOne(
      {functionId, filename},
      {$set: {functionId, filename, ...fields}},
      {upsert: true}
    );
  }

  async upsertMany(
    functionId: Id,
    assets: Array<Omit<FunctionAsset, "functionId" | "_id">>
  ): Promise<void> {
    await Promise.all(
      assets.map(({filename, ...fields}) => this.upsertAsset(functionId, filename, fields))
    );
  }

  async replaceKey(
    functionId: Id,
    filename: FunctionAssetFilename,
    from: string,
    to: string
  ): Promise<boolean> {
    const modified = await this.updateOne({functionId, filename, key: from}, {$set: {key: to}});
    return modified > 0;
  }

  deleteByFunction(functionId: Id): Promise<number> {
    return this.deleteMany({functionId});
  }
}
