import {useGetBucketQuery} from "../store/api/bucketApi";
import {useEngine} from "./useEngine";

export function useKeyField(bucketId?: string): string | undefined {
  const engine = useEngine();
  const {data: bucket} = useGetBucketQuery(bucketId as string, {skip: !bucketId});

  if (engine === "postgresql") {
    return bucket?.primary || undefined;
  }
  return engine === "mongodb" ? "_id" : undefined;
}
