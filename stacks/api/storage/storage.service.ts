import {Injectable} from "@nestjs/common";
import {Collection, DatabaseService, FilterQuery, ObjectId} from "@spica-server/database";
import {Service} from "./service";

@Injectable()
export class Storage {
  public readonly storageName: string = "storage";

  private _collection: Collection<StorageObject>;

  private service: Service;

  constructor(database: DatabaseService, private _service: Service) {
    this.service = _service;
    this._collection = database.collection("storage");
  }

  getAll(limit: number, skip: number = 0, sort?: any): Promise<StorageResponse> {
    let dataPipeline: object[] = [];

    dataPipeline.push({$skip: skip});

    if (limit) dataPipeline.push({$limit: limit});

    if (sort) dataPipeline.push({$sort: sort});

    const aggregation = [
      {
        $facet: {
          meta: [{$count: "total"}],
          data: dataPipeline
        }
      },
      {
        $project: {
          meta: {$arrayElemAt: ["$meta", 0]},
          data: "$data"
        }
      }
    ];

    return this._collection
      .aggregate(aggregation)
      .toArray()
      .then(async d => {
        for (const obj of (d[0] as any).data) {
          obj.url = await this.service.url(obj._id);
        }
        return d[0] as any;
      });
  }

  async get(id: ObjectId): Promise<StorageObject> {
    const object = await this._collection.findOne({_id: new ObjectId(id)});
    if (!object) return null;
    object.content.data = await this.service.read(id.toHexString());
    return object;
  }

  async deleteOne(id: ObjectId): Promise<void> {
    await this.service.delete(id.toHexString());
    return this._collection.deleteOne({_id: id}).then(() => undefined);
  }

  async updateOne(
    filter: FilterQuery<StorageObject>,
    object: StorageObject
  ): Promise<StorageObject> {
    if (object.content.data) {
      await this.service.write(object._id.toString(), object.content.data);
    }
    delete object.content.data;
    delete object._id;
    return this._collection.updateOne(filter, {$set: object}, {upsert: true}).then(() => object);
  }

  async insertMany(object: StorageObject[]): Promise<StorageObject[]> {
    const data = Array.from(object);

    await Promise.all(
      data.map(d => {
        d._id = new ObjectId(d._id);
        return this.service.write(d._id.toHexString(), d.content.data).then(() => {
          delete d.content.data;
        });
      })
    );

    return this._collection.insertMany(data).then(() => object);
  }

  async getUrl(id: string) {
    return this.service.url(id);
  }
}

export interface StorageObject {
  _id?: string | ObjectId;
  name?: string;
  url?: string;
  content: {
    data: Buffer;
    type: string;
    size?: number;
  };
}

export interface StorageResponse {
  meta: {
    count: number;
  };
  data: Array<StorageObject>;
}
