import {Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService} from "@spica-server/database";
import {PipelineBuilder} from "@spica-server/database-pipeline";
import {Id} from "@spica-server/interface-data";
import {
  StorageBrowseSpec,
  StorageObjectMeta,
  StorageRepository
} from "@spica-server/interface-storage";
import {translateWriteError} from "../errors.js";
import {StoragePipelineBuilder} from "./pipeline.builder.js";

@Injectable()
export class MongoStorageRepository
  extends BaseCollection<StorageObjectMeta>("storage")
  implements StorageRepository
{
  constructor(db: DatabaseService) {
    super(db, {
      afterInit: () => this._coll.createIndex({name: 1}, {unique: true})
    });
  }

  async insert(object: StorageObjectMeta) {
    await this._coll.insertOne(object).catch(translateWriteError);
    return object;
  }

  insertAll(objects: StorageObjectMeta[]) {
    return this._coll
      .insertMany(objects)
      .then(result => objects.map((s, i) => ({...s, _id: result.insertedIds[i]})))
      .catch(translateWriteError);
  }

  findById(id: Id) {
    return this._coll.findOne({_id: id});
  }

  findByName(name: string) {
    return this._coll.findOne({name});
  }

  findByIds(ids: Id[]) {
    return this._coll.find({_id: {$in: ids}}).toArray();
  }

  findByNames(names: string[]) {
    return this.find({name: {$in: names}});
  }

  async browse({resourceFilter, path, filter, sort, skip = 0, limit}: StorageBrowseSpec) {
    const convertedResourceFilter = StoragePipelineBuilder.createResourceFilter(
      resourceFilter as {
        include?: string[];
        exclude?: string[];
      }
    );

    const pathFilter = StoragePipelineBuilder.createPathFilter(path);

    const pipelineBuilder = (
      await new PipelineBuilder()
        .filterResources(convertedResourceFilter)
        .attachToPipeline(true, {$match: pathFilter})
        .filterByUserRequest(filter)
    ).result();

    const seeking = new PipelineBuilder().sort(sort).skip(skip).limit(limit).result();

    return this._coll.aggregate<StorageObjectMeta>([...pipelineBuilder, ...seeking]).toArray();
  }

  findByNamePrefix(prefix: string) {
    return this._coll.find(prefixFilter(prefix)).toArray();
  }

  totalSize(): Promise<number> {
    return this._coll
      .aggregate([
        {
          $group: {
            _id: "",
            total: {$sum: "$content.size"}
          }
        },
        {
          $project: {total: 1}
        }
      ])
      .toArray()
      .then((d: any) => (d.length ? d[0].total : 0));
  }

  async updateById(id: Id, fields: Partial<StorageObjectMeta>) {
    await this._coll.findOneAndUpdate({_id: id}, {$set: fields});
  }

  async renamePrefix(oldName: string, newName: string) {
    await this._coll.updateMany({$or: [{name: oldName}, prefixFilter(oldName)]}, [
      {
        $set: {
          name: {
            $cond: [
              {$eq: ["$name", oldName]},
              newName,
              {
                $replaceOne: {
                  input: "$name",
                  find: oldName,
                  replacement: newName
                }
              }
            ]
          }
        }
      }
    ]);
  }

  deleteById(id: Id) {
    return this._coll.findOneAndDelete({_id: id});
  }

  deleteByName(name: string) {
    return this._coll.findOneAndDelete({name});
  }

  deleteByIds(ids: Id[]) {
    return this._coll.deleteMany({_id: {$in: ids}}).then(r => r.deletedCount);
  }

  deleteByNamePrefix(prefix: string) {
    return this._coll.deleteMany(prefixFilter(prefix)).then(r => r.deletedCount);
  }
}

function prefixFilter(prefix: string) {
  return {name: {$regex: new RegExp(`^${StoragePipelineBuilder.escapeRegex(prefix)}`)}};
}
