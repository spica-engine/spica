import {Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService, ObjectId} from "@spica-server/database";
import {FunctionArtifact} from "@spica-server/interface-function-asset-storage";

const collectionName = "function_artifacts";

@Injectable()
export class FunctionArtifactService extends BaseCollection<FunctionArtifact>(collectionName) {
  constructor(database: DatabaseService) {
    super(database, {
      afterInit: () => Promise.all([this.createIndex({functionId: 1, platform: 1}, {unique: true})])
    });
  }

  async upsertArtifact(
    functionId: ObjectId,
    platform: string,
    fields: Omit<FunctionArtifact, "functionId" | "platform" | "_id">
  ): Promise<void> {
    await this._coll.updateOne(
      {functionId, platform},
      {$set: {functionId, platform, ...fields}},
      {upsert: true}
    );
  }

  async findReferencedKeys(): Promise<Set<string>> {
    const artifacts = await this.find({key: {$ne: null}});
    return new Set(artifacts.map(artifact => artifact.key));
  }

  deleteByFunction(functionId: ObjectId): Promise<number> {
    return this.deleteMany({functionId});
  }
}
