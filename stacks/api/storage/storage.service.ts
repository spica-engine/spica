import {Inject, Injectable} from "@nestjs/common";
import {Collection, DatabaseService, FilterQuery, ObjectId} from "@spica-server/database";
import * as fs from "fs";
import * as path from "path";
import {StorageOptions, STORAGE_OPTIONS} from "./options";

@Injectable()
export class Storage {
  private readonly path: string;
  public readonly storageName: string = "storage";

  private _collection: Collection<StorageObject>;

  constructor(database: DatabaseService, @Inject(STORAGE_OPTIONS) options: StorageOptions) {
    this._collection = database.collection("storage");
    this.path = path.resolve(options.path, "storage");
    if (!fs.existsSync(this.path)) {
      fs.mkdirSync(this.path);
    }
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
      .then(d => d[0] as any);
  }

  async get(id: ObjectId): Promise<StorageObject> {
    const object = await this._collection.findOne({_id: new ObjectId(id)});
    if (!object) return null;
    const path = this.buildPath(object);
    if (fs.existsSync(path)) {
      object.content.data = fs.readFileSync(path);
    }
    return object;
  }

  async deleteOne(id: ObjectId): Promise<void> {
    const object = await this.get(id);
    const path = this.buildPath(object);
    if (fs.existsSync(path)) {
      fs.unlinkSync(this.buildPath(object));
    }
    return this._collection.deleteOne({_id: id}).then(() => undefined);
  }

  updateOne(filter: FilterQuery<StorageObject>, object: StorageObject): Promise<StorageObject> {
    if (object.content.data) {
      fs.writeFileSync(this.buildPath({...object, _id: filter._id}), object.content.data);
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
        return fs.promises.writeFile(this.buildPath(d), d.content.data).then(_ => {
          delete d.content.data;
        });
      })
    );

    return this._collection.insertMany(data).then(() => object);
  }

  buildPath(object: StorageObject): string {
    return path.resolve(`${this.path}/${object._id}.storageobj`);
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
