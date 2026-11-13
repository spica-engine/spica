import {Session} from "@spica-server/data-postgresql-orm";
import {Bucket, StoredBucket} from "@spica-server/interface-bucket";
import {Id} from "@spica-server/interface-data";
import {buckets} from "../../entities/index.js";

export class StoredBuckets {
  constructor(private readonly session: Session) {}

  async find(id: Id | string) {
    return (await this.session.findById(buckets, id)) as StoredBucket | null;
  }

  async all() {
    return (await this.session.findMany(buckets, {})) as StoredBucket[];
  }

  async insert(bucket: Bucket) {
    return (await this.session.insert(buckets, bucket)) as StoredBucket;
  }

  async replace(id: Id, bucket: Bucket) {
    return (await this.session.replaceById(buckets, id, bucket)) as StoredBucket | null;
  }

  async delete(id: Id) {
    return (await this.session.deleteById(buckets, id)) as StoredBucket | null;
  }
}
