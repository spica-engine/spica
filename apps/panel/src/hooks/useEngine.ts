import {useGetEngineQuery} from "../store/api/statusApi";
import type {DataEngine} from "../store/api/statusApi";

export function useEngine(): DataEngine | undefined {
  const {data, isError} = useGetEngineQuery();
  return data?.engine ?? (isError ? "mongodb" : undefined);
}
