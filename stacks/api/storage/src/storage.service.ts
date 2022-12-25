import {Inject, Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService, ObjectId} from "@spica-server/database";
import {PipelineBuilder} from "@spica-server/database/pipeline";
import {StorageObject, StorageObjectContent} from "./body";
import {StorageOptions, STORAGE_OPTIONS} from "./options";
import {Strategy} from "./strategy/strategy";

@Injectable()
export class StorageService extends BaseCollection<StorageObject>("storage") {
  constructor(
    database: DatabaseService,
    private service: Strategy,
    @Inject(STORAGE_OPTIONS) private storageOptions: StorageOptions
  ) {
    super(database);
  }

  private existingSize(): Promise<number> {
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

  async getStatus() {
    return {
      limit: this.storageOptions.totalSizeLimit,
      current: await this.existingSize().then(bytes =>
        parseFloat((bytes * Math.pow(10, -6)).toFixed(2))
      ),
      unit: "mb"
    };
  }

  private async validateTotalStorageSize(size: number) {
    if (!this.storageOptions.totalSizeLimit) {
      return;
    }
    const existing = await this.existingSize();

    const neededInMb = (existing + size) * Math.pow(10, -6);
    if (neededInMb > this.storageOptions.totalSizeLimit) {
      throw new Error("Total storage object size limit exceeded");
    }
  }

  test() {
    this.getAll({}, undefined, false, 10, 10, {});
  }

  async getAll<P extends boolean>(
    resourceFilter: object,
    filter: object,
    paginate: P,
    limit: number,
    skip: number,
    sort?: any
  ): Promise<P extends true ? PaginatedStorageResponse : StorageResponse[]>;
  async getAll<P extends boolean>(
    resourceFilter: object,
    filter: object,
    paginate: P,
    limit: number,
    skip: number = 0,
    sort?: any
  ): Promise<PaginatedStorageResponse | StorageResponse[]> {
    let pipelineBuilder = await new PipelineBuilder()
      .filterResources(resourceFilter)
      .filterByUserRequest(filter);

    const seeking = new PipelineBuilder()
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .result();

    const pipeline = (await pipelineBuilder.paginate(
      paginate,
      seeking,
      this.estimatedDocumentCount()
    )).result();

    if (paginate) {
      return this._coll
        .aggregate<PaginatedStorageResponse>(pipeline)
        .next()
        .then(async r => {
          r.data = await this.putUrls(r.data);
          return r;
        });
    }

    return this._coll
      .aggregate<StorageResponse>([...pipeline, ...seeking])
      .toArray()
      .then(r => this.putUrls(r));
  }

  private async putUrls(objects: StorageResponse[]) {
    for (const object of objects) {
      object.url = await this.service.url(object._id.toString());
    }
    return objects;
  }

  // getAll(
  //   policyAgg: object[],
  //   filter:object,
  //   limit: number,
  //   skip: number = 0,
  //   sort?: any
  // ): Promise<StorageResponse> {
  //   const dataPipeline: object[] = [];

  //   if (sort) {
  //     dataPipeline.push({$sort: sort});
  //   }

  //   // sub-pipeline in $facet stage cannot be empty
  //   dataPipeline.push({$skip: skip});

  //   if (limit) {
  //     dataPipeline.push({$limit: limit});
  //   }

  //   const aggregation = [
  //     ...policyAgg,
  //     {
  //       $facet: {
  //         meta: [{$count: "total"}],
  //         data: dataPipeline
  //       }
  //     },
  //     {
  //       $project: {
  //         meta: {$ifNull: [{$arrayElemAt: ["$meta", 0]}, {total: 0}]},
  //         data: "$data"
  //       }
  //     }
  //   ];

  //   return this._coll
  //     .aggregate<StorageResponse>(aggregation)
  //     .next()
  //     .then(async result => {
  //       for (const object of result.data) {
  //         object.url = await this.service.url(object._id.toString());
  //       }
  //       return result;
  //     });
  // }

  async get(id: ObjectId): Promise<StorageObject> {
    const object = await this._coll.findOne({_id: new ObjectId(id)});
    if (!object) return null;
    object.content.data = await this.service.read(id.toHexString());
    return object;
  }

  async delete(id: ObjectId): Promise<void> {
    const deletedCount = await this._coll.deleteOne({_id: id}).then(res => res.deletedCount);

    if (!deletedCount) {
      return;
    }

    await this.service.delete(id.toHexString());
  }

  async updateMeta(_id: ObjectId, name: string) {
    const existing = await this._coll.findOne({_id});
    if (!existing) {
      throw new Error(`Storage object ${_id} could not be found`);
    }

    return this._coll
      .findOneAndUpdate({_id}, {$set: {name}}, {returnOriginal: false})
      .then(r => r.value);
  }

  async update(_id: ObjectId, object: StorageObject): Promise<StorageObject> {
    const existing = await this._coll.findOne({_id});
    if (!existing) {
      throw new Error(`Storage object ${_id} could not be found`);
    }

    await this.validateTotalStorageSize(object.content.size - existing.content.size);

    if (object.content.data) {
      await this.service.write(object._id.toString(), object.content.data, object.content.type);
    }
    delete object.content.data;
    delete object._id;
    return this._coll.findOneAndUpdate({_id}, {$set: object}).then(() => {
      return {...object, _id: _id};
    });
  }

  async insert(objects: StorageObject[]): Promise<StorageObject[]> {
    const datas = objects.map(object => object.content.data);
    const schemas = objects.map(object => {
      delete object.content.data;
      return object;
    });

    await this.validateTotalStorageSize(schemas.reduce((sum, curr) => sum + curr.content.size, 0));

    const insertedObjects = await this._coll
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

export type StorageResponse = Omit<StorageObject, "content"> & {
  content: Omit<StorageObjectContent, "data">;
};

export interface PaginatedStorageResponse {
  meta: {
    count: number;
  };
  data: StorageResponse[];
}
