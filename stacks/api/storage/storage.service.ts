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
          data: [{$skip: skip}, {$limit: limit}, {$sort: {_id: -1}}]
        }
      },
      {
        $project: {
          meta: {$arrayElemAt: ["$meta", 0]},
          data: "$data"
        }
      }
    ];

    let sortAggregation;
    if (order) {
      let parsedAggregation = JSON.parse(order);
      sortAggregation = {
        $sort: {}
      };
      sortAggregation.$sort = parsedAggregation;
      aggregation.unshift(sortAggregation);
    }

    return this._collection
      .aggregate(aggregation)
      .toArray()
      .then(d => d[0] as any);
  }

  async get(id: ObjectId): Promise<StorageObject> {
    const object = await this._collection.findOne({_id: new ObjectId(id)});
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

  upsertOne(object: StorageObject): Promise<StorageObject> {
    object._id = new ObjectId(object._id);
    if (object.content.data) {
      fs.writeFileSync(this.buildPath(object), object.content.data);
    }
    delete object.content.data;
    return this._collection
      .updateOne({_id: object._id}, {$set: object}, {upsert: true})
      .then(() => object);
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
