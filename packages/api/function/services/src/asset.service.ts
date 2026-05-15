import {Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService, ObjectId, WithId} from "@spica-server/database";
import {FunctionAsset, FunctionAssetFilename} from "@spica-server/interface-function-asset-storage";

const collectionName = "function_assets";

@Injectable()
export class FunctionAssetService extends BaseCollection<FunctionAsset>(collectionName) {
  constructor(database: DatabaseService) {
    super(database, {
      afterInit: () =>
        Promise.all([
          this.createIndex({functionId: 1, filename: 1}, {unique: true}),
          this.createIndex({functionId: 1})
        ])
    });
  }

  findByFunction(functionId: ObjectId): Promise<WithId<FunctionAsset>[]> {
    return this.find({functionId});
  }

  async upsertAsset(
    functionId: ObjectId,
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
    functionId: ObjectId,
    assets: Array<Omit<FunctionAsset, "functionId" | "_id">>
  ): Promise<void> {
    await Promise.all(
      assets.map(({filename, ...fields}) => this.upsertAsset(functionId, filename, fields))
    );
  }

  deleteByFunction(functionId: ObjectId): Promise<number> {
    return this.deleteMany({functionId});
  }
}
