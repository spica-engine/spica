import {Session} from "@spica-server/data-postgresql-orm";
import {Bucket, StoredBucket} from "@spica-server/interface-bucket";
import {Id} from "@spica-server/interface-data";
import {buckets} from "../../entities/index.js";
import {decodeBucket, encodeBucket} from "./rows.js";

export class StoredBuckets {
  constructor(private readonly session: Session) {}

  async find(id: Id | string) {
    return decodeBucket(await this.session.findById(buckets, id)) as StoredBucket | null;
  }

  async all() {
    return (await this.session.findMany(buckets, {})).map(decodeBucket) as StoredBucket[];
  }

  async insert(bucket: Bucket) {
    return decodeBucket(await this.session.insert(buckets, encodeBucket(bucket))) as StoredBucket;
  }

  async replace(id: Id, bucket: Bucket) {
    const replaced = await this.session.replaceById(buckets, id, encodeBucket(bucket));
    return decodeBucket(replaced) as StoredBucket | null;
  }

  async delete(id: Id) {
    return decodeBucket(await this.session.deleteById(buckets, id)) as StoredBucket | null;
  }
}
