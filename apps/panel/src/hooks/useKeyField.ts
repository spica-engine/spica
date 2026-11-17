import {useGetBucketQuery} from "../store/api/bucketApi";
import {bucketKeyField} from "../utils/recordKey";
import {useEngine} from "./useEngine";

export function useKeyField(bucketId?: string): string | undefined {
  const engine = useEngine();
  const {data: bucket} = useGetBucketQuery(bucketId as string, {skip: !bucketId});

  return bucketKeyField(engine, bucket);
}
