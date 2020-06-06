import {Inject, Injectable} from "@nestjs/common";
import {Collection, DatabaseService, FilterQuery, ObjectId} from "@spica-server/database";
import {StorageOptions, STORAGE_OPTIONS} from "./options";
import {Default, Strategy, GCloud} from "./strategy";

@Injectable()
export class Storage {
  public readonly storageName: string = "storage";

  private _collection: Collection<StorageObject>;

  service: Strategy;

  constructor(database: DatabaseService, @Inject(STORAGE_OPTIONS) options: StorageOptions) {
    if (options.strategy == "default") {
      this.service = new Default(options.path, options.publicUrl);
    } else if (options.strategy == "gcloud") {
      this.service = new GCloud(`${__dirname}/service_account.json`);
    }
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
      .then(d => {
        d[0]["data"] = (d[0] as any).data.map(m => {
          m.url = this.service.url(m._id);
          return m;
        });
        return d[0] as any;
      });
  }

  async get(id: ObjectId): Promise<StorageObject> {
    const object = await this._collection.findOne({_id: new ObjectId(id)});
    if (!object) return null;
    object.content.data = this.service.read(id.toHexString());
    return object;
  }

  async deleteOne(id: ObjectId): Promise<void> {
    const object = await this.get(id);
    this.service.delete(object);
    return this._collection.deleteOne({_id: id}).then(() => undefined);
  }

  updateOne(filter: FilterQuery<StorageObject>, object: StorageObject): Promise<StorageObject> {
    if (object.content.data) {
      this.service.writeSync(filter._id, object.content.data);
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
        return this.service.writeAsync(d._id.toHexString(), d.content.data).then(() => {
          delete d.content.data;
        });
      })
    );

    return this._collection.insertMany(data).then(() => object);
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
