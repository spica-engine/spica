import {Injectable} from "@nestjs/common";
import {Collection, DatabaseService, ObjectId} from "@spica-server/database";
import * as fs from "fs";
import * as path from "path";

@Injectable()
export class Storage {
  private readonly path: string;
  public readonly storageName: string = "storage";

  private _collection: Collection<StorageObject>;

  constructor(database: DatabaseService, pPath: string) {
    this._collection = database.collection("storage");
    this.path = path.resolve(pPath, "storage");
    if (!fs.existsSync(this.path)) {
      fs.mkdirSync(this.path);
    }
  }

  getAll(limit: number, skip: number, order?: any): Promise<StorageResponse> {
    const aggregation = [
      {
        $facet: {
          meta: [{$count: "total"}],
          data: [{$skip: skip}, {$limit: limit}, order && {$sort: order}].filter(Boolean)
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

  updateOne(object: StorageObject): Promise<StorageObject> {
    if (object.content.data) {
      fs.writeFileSync(this.buildPath(object), object.content.data);
    }
    delete object.content.data;
    object._id = new ObjectId(object._id);
    return this._collection
      .updateOne({_id: object._id}, {$set: object}, {upsert: true})
      .then(() => object);
  }

  insertMany(object: StorageObject[]): Promise<StorageObject[]> {
    const data = Array.from(object);

    Promise.all(
      data.map(d => {
        d._id = new ObjectId(d._id);
        fs.writeFileSync(this.buildPath(d), d.content.data);
        delete d.content.data;
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
