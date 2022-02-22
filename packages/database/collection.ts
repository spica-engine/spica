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

export interface InitializeOptions {
  entryLimit?: number;
  collectionCreateOptions?: CollectionCreateOptions;
  afterInit?: (...args) => any;
}

export type OptionalId<T> = Omit<T, "_id"> & {_id?: ObjectId | string | number};

export class _MixinCollection<T> {
  _coll: Collection<T>;

  options: InitializeOptions;

  constructor(
    public readonly db: DatabaseService,
    public readonly _collection: string,
    public readonly _options: InitializeOptions = {}
  ) {
    this._coll = db.collection(this._collection);

    this.options = this._options;

    if (this.options.afterInit) {
      this.initCollection().then(() => this.options.afterInit());
    }
  }

  initCollection() {
    return this.db.createCollection(this._collection).catch(e => {
      if (e.codeName == "NamespaceExists") {
        return;
      }
      throw e;
    });
  }

  async getStatus() {
    return {
      limit: this.options ? this.options.entryLimit : undefined,
      current: await this._coll.estimatedDocumentCount(),
      unit: "count"
    };
  }

  estimatedDocumentCount(): Promise<number> {
    return this._coll.estimatedDocumentCount();
  }

  aggregate<ResponseType>(
    pipeline?: object[],
    options: CollectionAggregationOptions = {allowDiskUse: true}
  ): AggregationCursor<ResponseType> {
    return this._coll.aggregate(pipeline, options);
  }

  async documentCountLimitValidation(insertedDocumentCount: number) {
    if (this.options && this.options.entryLimit) {
      const existingDocumentCount = await this._coll.estimatedDocumentCount();

      if (existingDocumentCount + insertedDocumentCount > this.options.entryLimit) {
        throw new Error("Maximum number of documents has been reached");
      }
    }
  }

  // Insert
  async insertOne(doc: T): Promise<T> {
    await this.documentCountLimitValidation(1);

    return this._coll.insertOne(doc).then(t => t.ops[0]);
  }

  async insertMany(docs: Array<T>): Promise<ObjectId[]> {
    await this.documentCountLimitValidation(docs.length);

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

  collection(collection: string, options?: InitializeOptions) {
    return new _MixinCollection(this.db, collection, options);
  }
}

export type BaseCollection<T> = _MixinCollection<T>;

export function BaseCollection<T extends OptionalId<T>>(collection?: string) {
  return class extends _MixinCollection<T> {
    constructor(db: DatabaseService, options?: InitializeOptions) {
      super(db, collection, options);
    }
  };
}
