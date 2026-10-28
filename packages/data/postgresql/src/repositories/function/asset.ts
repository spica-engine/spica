import {Inject, Injectable} from "@nestjs/common";
import {Orm} from "@spica-server/data-postgresql-orm";
import {Id} from "@spica-server/interface-data";
import {
  FunctionAsset,
  FunctionAssetFilename,
  FunctionAssetRepository
} from "@spica-server/interface-function-asset-storage";
import {functionAssets} from "../../entities/index.js";
import {ORM} from "../../orm.js";

const CONFLICT = {conflict: ["functionId", "filename"]};

@Injectable()
export class PostgresFunctionAssetRepository implements FunctionAssetRepository {
  constructor(@Inject(ORM) private readonly orm: Orm) {}

  findByFunction(functionId: Id) {
    return this.orm.findMany(functionAssets, {functionId}, {orderBy: {_id: "asc"}});
  }

  findByFilename(functionId: Id, filename: FunctionAssetFilename) {
    return this.orm.findOne(functionAssets, {functionId, filename});
  }

  async upsertAsset(
    functionId: Id,
    filename: FunctionAssetFilename,
    fields: Omit<FunctionAsset, "functionId" | "filename" | "_id">
  ) {
    await this.orm.upsert(functionAssets, {...fields, functionId, filename}, CONFLICT);
  }

  async upsertMany(functionId: Id, assets: Array<Omit<FunctionAsset, "functionId" | "_id">>) {
    await this.orm.transaction(async session => {
      for (const asset of assets) {
        await session.upsert(functionAssets, {...asset, functionId}, CONFLICT);
      }
    });
  }

  async replaceKey(functionId: Id, filename: FunctionAssetFilename, from: string, to: string) {
    const moved = await this.orm.updateMany(
      functionAssets,
      {functionId, filename, key: from},
      {key: to}
    );
    return moved.length > 0;
  }

  async deleteByFunction(functionId: Id) {
    return await this.orm.deleteWhere(functionAssets, {functionId});
  }
}
