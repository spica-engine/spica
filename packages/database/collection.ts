import {
  AggregationCursor,
  Collection,
  CollectionOptions,
  Filter,
  FindOptions,
  FindOneAndDeleteOptions,
  FindOneAndReplaceOptions,
  FindOneAndUpdateOptions,
  InsertOneResult,
  InsertManyResult,
  UpdateResult,
  ObjectId,
  UpdateFilter,
  UpdateOptions
} from "mongodb";
import {DatabaseService} from "./database.service";

export interface InitializeOptions {
  entryLimit?: number;
  collectionOptions?: CollectionOptions;
  afterInit?: (...args: any[]) => any;
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
      this.initCollection().then(() => this.options.afterInit!());
    }
  }

  initCollection() {
    return this.db.createCollection(this._collection, this.options.collectionOptions).catch(e => {
      if (e.codeName === "NamespaceExists") {
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
    options: {allowDiskUse?: boolean} = {allowDiskUse: true}
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

    const result: InsertOneResult<T> = await this._coll.insertOne(doc);
    return doc; // Return the inserted document
  }

  async insertMany(docs: Array<T>): Promise<ObjectId[]> {
    await this.documentCountLimitValidation(docs.length);

    const result: InsertManyResult<T> = await this._coll.insertMany(docs);
    return Object.values(result.insertedIds);
  }

  // Find
  findOne(filter: Filter<T>, options?: FindOptions): Promise<T | null> {
    return this._coll.findOne(filter, options);
  }

  find(filter?: Filter<T>, options?: FindOptions): Promise<T[]> {
    return this._coll.find(filter, options).toArray();
  }

  // Delete
  findOneAndDelete(filter: Filter<T>, options?: FindOneAndDeleteOptions): Promise<T | null> {
    return this._coll.findOneAndDelete(filter, options);
  }

  deleteOne(filter: Filter<T>, options?: FindOptions): Promise<number> {
    return this._coll.deleteOne(filter, options).then(r => r.deletedCount || 0);
  }

  deleteMany(filter: Filter<T>, options?: FindOptions): Promise<number> {
    return this._coll.deleteMany(filter, options).then(r => r.deletedCount || 0);
  }

  // Replace
  findOneAndReplace(
    filter: Filter<T>,
    doc: T,
    options?: FindOneAndReplaceOptions
  ): Promise<T | null> {
    return this._coll.findOneAndReplace(filter, doc, options);
  }

  replaceOne(filter: Filter<T>, doc: T, options?: UpdateOptions): Promise<number> {
    return this._coll.replaceOne(filter, doc, options).then(r => r.modifiedCount);
  }

  // Update
  updateMany(
    filter: Filter<T>,
    update: UpdateFilter<T> | T,
    options?: UpdateOptions
  ): Promise<number> {
    return this._coll.updateMany(filter, update, options).then(r => r.modifiedCount);
  }

  updateOne(
    filter: Filter<T>,
    update: UpdateFilter<T> | T,
    options?: UpdateOptions
  ): Promise<number> {
    return this._coll.updateOne(filter, update, options).then(r => r.modifiedCount);
  }

  findOneAndUpdate(
    filter: Filter<T>,
    update: UpdateFilter<T> | T,
    options?: FindOneAndUpdateOptions
  ): Promise<T | null> {
    return this._coll.findOneAndUpdate(filter, update, options);
  }

  // Time to live index
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
