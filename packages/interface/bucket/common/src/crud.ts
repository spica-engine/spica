import {BaseCollection} from "@spica-server/database";
import {Id} from "@spica-server/interface-data";
import {Bucket, BucketPreferences} from "@spica-server/interface-bucket";

export interface CrudFactories<T> {
  collection: (schema: Bucket) => BaseCollection<T>;
  preference: () => Promise<BucketPreferences>;
  schema: (id: string | Id) => Promise<Bucket> | Bucket;
}
