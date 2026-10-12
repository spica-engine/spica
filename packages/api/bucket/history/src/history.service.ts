import {Injectable} from "@nestjs/common";
import {DatabaseService, Filter, getCollection, ObjectId, WithId} from "@spica-server/database";
import {ICollection} from "@spica-server/database-driver";
import {diff, schemaDiff} from "@spica-server/core-differ";
import {ChangePaths, ChangeKind} from "@spica-server/interface-core";
import {History} from "@spica-server/interface-bucket-history";
import {Bucket, BucketDocument} from "@spica-server/interface-bucket";

@Injectable()
export class HistoryService {
  readonly collection: ICollection<History>;
  constructor(private db: DatabaseService) {
    this.collection = getCollection<History>(this.db, "history");
  }

  updateHistories(previousSchema: Bucket, currentSchema: Bucket) {
    const changes = schemaDiff(previousSchema, currentSchema).filter(
      ({lastPath, path, kind}) =>
        path.length > 0 &&
        (kind == ChangeKind.Delete ||
          (kind == ChangeKind.Edit &&
            (lastPath[0] == "bucket" ||
              lastPath[0] == "relationType" ||
              lastPath[0] == "type" ||
              (lastPath[0] == "options" && lastPath[1] == "translate"))))
    );
    return Promise.all(
      changes.map(change => this.deleteHistoryAtPath(currentSchema._id, change.path))
    );
  }

  /** Because it delegates to `insertOne`, the contract makes it return the **document**; nothing when there is no change. */
  createHistory(
    bucketId: ObjectId,
    previousDocument: BucketDocument,
    currentDocument: BucketDocument
  ): Promise<WithId<History>> | void {
    const changes = diff(currentDocument, previousDocument);
    if (changes.length > 0) {
      const history: History = {
        bucket_id: bucketId,
        document_id: currentDocument._id,
        changes
      };
      return this.insertOne(history);
    }
  }

  // We can not use BucketDataService as a direct dependency
  getDocument(bucketId: ObjectId, documentId: ObjectId) {
    return getCollection<BucketDocument>(this.db, `bucket_${bucketId}`).findOne({_id: documentId});
  }

  findBetweenNow(bucketId: ObjectId, documentId: ObjectId, id: ObjectId) {
    return this.collection
      .aggregate([
        {
          $match: {$and: [{bucket_id: bucketId}, {document_id: documentId}, {_id: {$gte: id}}]}
        },
        {
          $sort: {_id: -1}
        }
      ])
      .toArray();
  }

  find(filter: Filter<History>) {
    return this.collection
      .aggregate([
        {
          $match: filter
        },
        {
          $project: {
            date: {$convert: {input: "$_id", to: "date"}},
            changes: {$size: "$changes"}
          }
        },
        {
          $sort: {
            _id: -1
          }
        }
      ])
      .toArray();
  }

  getHistory(filter: Filter<History>): Promise<History> {
    return this.collection.findOne(filter);
  }

  /** The contract makes it return the **number** deleted. */
  async deleteHistoryAtPath(bucketId: ObjectId, path: ChangePaths): Promise<number> {
    const paths = path.reduce((queries, path, index) => {
      // We simply converting the positional path to match with any number
      if ((path as any) instanceof RegExp) {
        path = {$type: 16} as any;
      }
      queries[`path.${index}`] = path;
      return queries;
    }, {});
    await this.collection.updateMany(
      {bucket_id: bucketId, changes: {$elemMatch: paths}},
      {
        $pull: {
          changes: paths
        }
      }
    );
    // Clear all the history that lost it's changes due to type changes.
    return this.collection.deleteMany({changes: {$size: 0}});
  }

  /** The contract makes it return the **number** deleted (not a `DeleteResult`). */
  deleteMany(filter: Filter<History>): Promise<number> {
    return this.collection.deleteMany(filter);
  }

  /** The contract makes it return the inserted **document** (not an `InsertOneResult`). */
  async insertOne(history: History): Promise<WithId<History>> {
    const recordCount = await this.collection.countDocuments({
      bucket_id: history.bucket_id,
      document_id: history.document_id
    });

    if (recordCount >= 10) {
      /**
       * The **oldest** record is the one to go, and saying so takes an explicit sort.
       *
       * This was a bare `deleteOne` with no order: it removed whichever matching record the storage
       * layer happened to return first. On MongoDB that is usually insertion order; PostgreSQL's
       * `LIMIT 1` has no order at all. Either way a user could lose their newest history entry instead
       * of their oldest.
       */
      await this.collection.findOneAndDelete(
        {$and: [{bucket_id: history.bucket_id}, {document_id: history.document_id}]},
        {sort: {_id: 1}}
      );
    }

    return this.collection.insertOne({...history, _id: new ObjectId(history._id)});
  }
}
