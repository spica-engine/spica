import {
  AggregationCursor,
  Collection,
  CollectionAggregationOptions,
  FilterQuery,
  FindOneAndDeleteOption,
  FindOneAndReplaceOption,
  FindOneAndUpdateOption,
  FindOneOptions,
  ObjectId,
  UpdateManyOptions,
  UpdateQuery,
  CollectionCreateOptions
} from "mongodb";
import {DatabaseService} from "./database.service";

// Rebase: export type OptionalId<T> = Omit<T, "_id"> & {_id?: ObjectId | string | number};
export type OptionalId<T> = Omit<T, "_id"> & {_id?: ObjectId | string | number};

export class _MixinCollection<T> {
  _coll: Collection<T>;
  constructor(public readonly db: DatabaseService, public readonly _collection: string) {
    this._coll = db.collection(this._collection);
  }

  estimatedDocumentCount(): Promise<number> {
    return this._coll.estimatedDocumentCount();
  }

  aggregate<ResponseType>(
    pipeline?: object[],
    options?: CollectionAggregationOptions
  ): AggregationCursor<ResponseType> {
    return this._coll.aggregate(pipeline, options);
  }

  createCollection(
    name: string,
    options?: CollectionCreateOptions & {ignoreAlreadyExist?: boolean}
  ): Promise<Collection<any>> {
    if (options && options.ignoreAlreadyExist) {
      delete options.ignoreAlreadyExist;
      return this.db.createCollection(name, options).catch(error => {
        if (error.codeName == "NamespaceExists") {
          return this._coll;
        }
        throw new Error(error);
      });
    }
    return this.db.createCollection(name, options);
  }

  // Insert
  insertOne(doc: T): Promise<T> {
    return this._coll.insertOne(doc).then(t => t.ops[0]);
  }

  insertMany(docs: Array<T>): Promise<ObjectId[]> {
    return this._coll.insertMany(docs).then(t => Object.values(t.insertedIds));
  }

  // Find
  findOne(filter: FilterQuery<T>, options?: FindOneOptions): Promise<T> {
    return this._coll.findOne(filter, options);
  }

  find(filter?: FilterQuery<T>, options?: FindOneOptions): Promise<T[]> {
    return this._coll.find(filter, options).toArray();
  }

  // Delete
  findOneAndDelete(filter: FilterQuery<T>, options?: FindOneAndDeleteOption): Promise<T> {
    return this._coll.findOneAndDelete(filter, options).then(r => r.value);
  }

  deleteOne(filter: FilterQuery<T>, options?: FindOneAndDeleteOption): Promise<number> {
    return this._coll.deleteOne(filter, options).then(r => r.deletedCount);
  }

  deleteMany(filter: FilterQuery<T>, options?: FindOneAndDeleteOption): Promise<number> {
    return this._coll.deleteMany(filter, options).then(r => r.deletedCount);
  }

  // Replace
  findOneAndReplace(filter: FilterQuery<T>, doc: T, options?: FindOneAndReplaceOption): Promise<T> {
    return this._coll.findOneAndReplace(filter, Object(doc), options).then(r => r.value);
  }

  replaceOne(filter: FilterQuery<T>, doc: T, options?: FindOneAndReplaceOption): Promise<number> {
    return this._coll.replaceOne(filter, doc, options).then(r => r.modifiedCount);
  }

  // Update
  updateMany(
    filter: FilterQuery<T>,
    update: T | UpdateQuery<T>,
    options?: UpdateManyOptions
  ): Promise<number> {
    return this._coll.updateMany(filter, update, options).then(r => r.result.nModified);
  }

  updateOne(
    filter: FilterQuery<T>,
    update: T | UpdateQuery<T>,
    options?: UpdateManyOptions
  ): Promise<number> {
    return this._coll.updateOne(filter, update, options).then(r => r.result.nModified);
  }

  findOneAndUpdate(
    filter: FilterQuery<T>,
    update: T | UpdateQuery<T>,
    options?: FindOneAndUpdateOption
  ): Promise<T> {
    return this._coll.findOneAndUpdate(filter, update, options).then(r => r.value);
  }

  //Time to live index
  upsertTTLIndex(expireAfterSeconds: number) {
    return this._coll
      .listIndexes()
      .toArray()
      .then(indexes => {
        const ttlIndex = indexes.find(index => index.name == "created_at_1");
        if (!ttlIndex) {
          return this._coll.createIndex({created_at: 1}, {expireAfterSeconds: expireAfterSeconds});
        } else if (ttlIndex && ttlIndex.expireAfterSeconds != expireAfterSeconds) {
          return this.db.command({
            collMod: this._collection,
            index: {
              keyPattern: {created_at: 1},
              expireAfterSeconds: expireAfterSeconds
            }
          });
        }
      });
  }

  collection(collection: string) {
    return new _MixinCollection(this.db, collection);
  }
}

export type BaseCollection<T> = _MixinCollection<T>;

export function BaseCollection<T extends OptionalId<T>>(collection?: string) {
  return class extends _MixinCollection<T> {
    constructor(db: DatabaseService) {
      super(db, collection);
    }
  };
}
