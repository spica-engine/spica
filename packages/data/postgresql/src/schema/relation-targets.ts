import {Bucket} from "@spica-server/interface-bucket";
import {RelationTarget, RelationTargets} from "./metadata/types.js";
import {mainTableName} from "./naming.js";
import {tryPrimaryKeyMetadata} from "./primary-key.js";
import {relationTargets} from "./relations.js";

export async function resolveRelationTargets(
  bucket: Bucket,
  find: (bucketId: string) => Promise<Bucket | null | undefined>
): Promise<RelationTargets> {
  const resolved = new Map<string, RelationTarget>();
  for (const targetId of relationTargets(bucket.properties)) {
    if (targetId == String(bucket._id)) {
      continue;
    }
    const target = await find(targetId);
    const primaryKey = target && tryPrimaryKeyMetadata(target);
    if (primaryKey) {
      resolved.set(targetId, {table: mainTableName(targetId), primaryKey});
    }
  }
  return targetId => resolved.get(targetId);
}
