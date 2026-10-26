import {Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService, ReturnDocument} from "@spica-server/database";
import {Id} from "@spica-server/interface-data";
import {Bucket, BucketRepository} from "@spica-server/interface-bucket";

@Injectable()
export class MongoBucketRepository
  extends BaseCollection<Bucket>("buckets")
  implements BucketRepository
{
  constructor(db: DatabaseService) {
    super(db);
  }

  findAll() {
    return this.find();
  }

  findById(id: Id) {
    return this.findOne({_id: id});
  }

  insert(bucket: Bucket) {
    return this.insertOne(bucket);
  }

  replaceById(id: Id, bucket: Bucket) {
    return this.findOneAndReplace({_id: id}, bucket, {returnDocument: ReturnDocument.AFTER});
  }

  deleteById(id: Id) {
    return this.findOneAndDelete({_id: id});
  }

  unsetProperties(id: Id, paths: string[]) {
    return this.updateMany({_id: id}, {$unset: Object.fromEntries(paths.map(path => [path, ""]))});
  }

  sumOfCountLimits() {
    return this.aggregate([
      {
        $group: {
          _id: "",
          total: {
            $sum: "$documentSettings.countLimit"
          }
        }
      },
      {
        $project: {
          total: 1
        }
      }
    ])
      .toArray()
      .then((d: any[]) => (d.length ? d[0].total : 0));
  }

  findTranslatable() {
    return this.aggregate<Bucket & {_id: Id}>([
      {
        $project: {
          properties: {
            $objectToArray: "$properties"
          }
        }
      },
      {
        $match: {
          "properties.v.options.translate": true
        }
      },
      {
        $project: {
          properties: {
            $filter: {
              input: "$properties",
              as: "property",
              cond: {$eq: ["$$property.v.options.translate", true]}
            }
          }
        }
      },
      {
        $project: {
          properties: {
            $arrayToObject: "$properties"
          }
        }
      }
    ]).toArray();
  }

  findReferencing(bucketId: string) {
    return this.aggregate<{_id: Id}>([
      {$project: {properties: {$objectToArray: "$properties"}}},
      {$match: {"properties.v.bucketId": bucketId}}
    ])
      .toArray()
      .then(buckets => buckets.map(bucket => bucket._id.toString()));
  }

  status() {
    return this.getStatus() as Promise<{limit?: number; current: number; unit: "count"}>;
  }
}
