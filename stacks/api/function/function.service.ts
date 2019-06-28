import {
  Collection,
  DatabaseService,
  DeleteWriteOpResultObject,
  FilterQuery,
  ObjectId
} from "@spica-server/database";
import {Injectable} from "@nestjs/common";
import {FunctionEngine} from "./engine/engine";
import {Function} from "./interface";

@Injectable()
export class FunctionService {
  private _collection: Collection<Function>;

  constructor(database: DatabaseService, private engine: FunctionEngine) {
    this._collection = database.collection("function");
  }

  find(filter?: FilterQuery<Function>): Promise<Function[]> {
    return this._collection.find(filter).toArray();
  }

  findOne(filter: FilterQuery<Function>): Promise<Function> {
    return this._collection.findOne(filter);
  }

  async upsertOne(fn: Function): Promise<Function> {
    this.engine.host.create(fn, "");
    const _fn = await this._collection.findOne({_id: new ObjectId(fn._id)});
    if (_fn) {
      // We need to pass original document in order to
      // Clean up the old references gracefully.
      this.engine.refuse(_fn);
    }
    return this._collection
      .updateOne(
        {_id: new ObjectId(fn._id)},
        {$set: fn},
        {
          upsert: true
        }
      )
      .then(() => {
        this.engine.introduce(fn);
        return fn;
      });
  }

  async deleteOne(id: string): Promise<DeleteWriteOpResultObject> {
    const fn = await this._collection.findOne({_id: new ObjectId(id)});
    if (fn) {
      this.engine.refuse(fn);
    }
    return this._collection.deleteOne({_id: new ObjectId(id)});
  }
}
