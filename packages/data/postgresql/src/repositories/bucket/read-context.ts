import {Session} from "@spica-server/data-postgresql-orm";
import {BucketReadContext} from "@spica-server/interface-bucket-common";
import {StoredBuckets} from "./stored-buckets.js";

const preferencesUnavailable = () => Promise.reject(new Error("Preferences are not read here."));

export function keyedReadContext(session: Session): BucketReadContext {
  const stored = new StoredBuckets(session);
  return {
    resolveSchema: async id => {
      const bucket = await stored.find(id);
      if (!bucket) {
        throw new Error(`Bucket ${id} does not exist.`);
      }
      return bucket;
    },
    preferences: preferencesUnavailable
  };
}
