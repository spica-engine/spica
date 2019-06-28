import {Injectable} from "@nestjs/common";
import {
  Collection,
  DatabaseService,
  DeleteWriteOpResultObject,
  FilterQuery,
  ObjectId
} from "@spica-server/database";
import {Strategy} from "../interface";

@Injectable()
export class StrategyService {
  private _collection: Collection<Strategy>;

  constructor(database: DatabaseService) {
    this._collection = database.collection("strategy");
  }

  find<T extends Strategy>(filter?: FilterQuery<Strategy>): Promise<T[]> {
    return this._collection.find(filter).toArray() as Promise<T[]>;
  }

  findOne<T extends Strategy>(filter: FilterQuery<Strategy>): Promise<T> {
    return this._collection.findOne(filter);
  }

  replaceOne(strategy: Strategy): Promise<boolean> {
    const body = {...strategy};
    delete body._id;
    return this._collection
      .replaceOne({_id: new ObjectId(strategy._id)}, body, {
        upsert: true
      })
      .then(r => r.result.ok == 1);
  }

  deleteOne(filter: FilterQuery<Strategy>): Promise<DeleteWriteOpResultObject> {
    return this._collection.deleteOne(filter);
  }
}
