import {Inject, Injectable} from "@nestjs/common";
import {Collection, DatabaseService, FilterQuery, ObjectId} from "@spica-server/database";
import {StorageObject} from "./body";
import {StorageOptions, STORAGE_OPTIONS} from "./options";
import {Strategy} from "./strategy/strategy";

@Injectable()
export class StorageService {
  private _collection: Collection<StorageObject>;

  constructor(
    database: DatabaseService,
    private service: Strategy,
    @Inject(STORAGE_OPTIONS) private options: StorageOptions
  ) {
    this._collection = database.collection("storage");
  }

  private async validateTotalStorageSize(size: number) {
    if (!this.options.totalSizeLimit) {
      return;
    }
    const existing = await this._collection
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

    const neededInMb = (existing + size) * Math.pow(10, -6);
    if (neededInMb > this.options.totalSizeLimit) {
      throw new Error("Total storage object size limit exceeded");
    }
  }

  getAll(
    policyAgg: object[],
    limit: number,
    skip: number = 0,
    sort?: any
  ): Promise<StorageResponse> {
    const dataPipeline: object[] = [];

    if (sort) {
      dataPipeline.push({$sort: sort});
    }

    // sub-pipeline in $facet stage cannot be empty
    dataPipeline.push({$skip: skip});

    if (limit) {
      dataPipeline.push({$limit: limit});
    }

    const aggregation = [
      ...policyAgg,
      {
        $facet: {
          meta: [{$count: "total"}],
          data: dataPipeline
        }
      },
      {
        $project: {
          meta: {$ifNull: [{$arrayElemAt: ["$meta", 0]}, {total: 0}]},
          data: "$data"
        }
      }
    ];

    return this._collection
      .aggregate<StorageResponse>(aggregation)
      .next()
      .then(async result => {
        for (const object of result.data) {
          object.url = await this.service.url(object._id.toString());
        }
        return result;
      });
  }

  async get(id: ObjectId): Promise<StorageObject> {
    const object = await this._collection.findOne({_id: new ObjectId(id)});
    if (!object) return null;
    object.content.data = await this.service.read(id.toHexString());
    return object;
  }

  async deleteOne(id: ObjectId): Promise<void> {
    const deletedCount = await this._collection.deleteOne({_id: id}).then(res => res.deletedCount);

    if (!deletedCount) {
      return;
    }

    await this.service.delete(id.toHexString());
  }

  async updateOne(_id: ObjectId, object: StorageObject): Promise<StorageObject> {
    const existing = await this._collection.findOne({_id});
    if (!existing) {
      throw new Error(`Storage object ${_id} could not be found`);
    }

    await this.validateTotalStorageSize(object.content.size - existing.content.size);

    if (object.content.data) {
      await this.service.write(object._id.toString(), object.content.data, object.content.type);
    }
    delete object.content.data;
    delete object._id;
    return this._collection.findOneAndUpdate({_id}, {$set: object}).then(() => object);
  }

  async insertMany(objects: StorageObject[]): Promise<StorageObject[]> {
    const datas = objects.map(object => object.content.data);
    const schemas = objects.map(object => {
      delete object.content.data;
      return object;
    });

    await this.validateTotalStorageSize(schemas.reduce((sum, curr) => sum + curr.content.size, 0));

    const insertedObjects = await this._collection
      .insertMany(schemas)
      .then(result => result.ops as StorageObject[]);

    for (const [i, object] of insertedObjects.entries()) {
      await this.service.write(object._id.toString(), datas[i], object.content.type);
    }

    return insertedObjects;
  }

  async getUrl(id: string) {
    return this.service.url(id);
  }
}

export interface StorageResponse {
  meta: {
    count: number;
  };
  data: Array<StorageObject>;
}
