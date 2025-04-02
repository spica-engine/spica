import {Injectable} from "@nestjs/common";
import {
  Collection,
  DatabaseService,
  DeleteResult,
  Filter,
  InsertOneResult,
  ObjectId
} from "@spica-server/database";
import {diff, schemaDiff} from "@spica-server/core/differ";
import {ChangePaths, ChangeKind} from "@spica-server/interface/core";
import {History} from "@spica-server/interface/bucket/history";
import {Bucket, BucketDocument} from "@spica-server/interface/bucket";

@Injectable()
export class HistoryService {
  readonly collection: Collection<History>;
  constructor(private db: DatabaseService) {
    this.collection = this.db.collection<History>("history");
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

  createHistory(
    bucketId: ObjectId,
    previousDocument: BucketDocument,
    currentDocument: BucketDocument
  ) {
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
    return this.db.collection<BucketDocument>(`bucket_${bucketId}`).findOne({_id: documentId});
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

  async deleteHistoryAtPath(bucketId: ObjectId, path: ChangePaths) {
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

  deleteMany(filter: Filter<History>): Promise<DeleteResult> {
    return this.collection.deleteMany(filter);
  }

  async insertOne(history: History): Promise<InsertOneResult> {
    const recordCount = await this.collection
      .find({$and: [{bucket_id: history.bucket_id}, {document_id: history.document_id}]})
      .count();

    if (recordCount >= 10) {
      await this.collection.deleteOne({
        $and: [{bucket_id: history.bucket_id}, {document_id: history.document_id}]
      });
    }

    return this.collection.insertOne({...history, _id: new ObjectId(history._id)});
  }
}
