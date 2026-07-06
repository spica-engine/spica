import {useMemo} from "react";
import type {BucketDataQueryType} from "../store/api/bucketApi";
import {useBucketData, useRelationQueryParam} from "./useBucketData";
import type {UseBucketDataResult} from "./useBucketData";
import {useBucketDataRealtime} from "./useBucketDataRealtime";
import useLocalStorage from "./useLocalStorage";

export type BucketDataStrategy = "http" | "realtime";

export function bucketDataStrategyKey(bucketId: string): string {
  return `${bucketId}-data-strategy`;
}

// Picks the per-bucket retrieval strategy from localStorage and returns a
// UseBucketDataResult from whichever transport is active. Both hooks are mounted
// (hooks can't be conditional) but the inactive one is disabled: the HTTP RTK
// query is skipped and the realtime socket is never opened.
export function useBucketDataStrategy(
  bucketId: string,
  searchQuery: BucketDataQueryType | undefined
): UseBucketDataResult {
  const [strategy] = useLocalStorage<BucketDataStrategy>(
    bucketDataStrategyKey(bucketId),
    "http"
  );

  const isRealtime = strategy === "realtime";

  // Relation resolution is an HTTP-only optimization; the realtime transport is
  // left untouched.
  const {relation, ready} = useRelationQueryParam(bucketId);
  const httpSearchQuery = useMemo(() => {
    const merged: BucketDataQueryType = {...searchQuery};
    if (relation !== undefined) merged.relation = relation;
    else delete merged.relation;
    return merged;
  }, [searchQuery, relation]);

  // Defer the list request until the schema-derived relation param is known, so
  // it fires once with the right value instead of a no-relation fetch + refetch.
  const httpResult = useBucketData(bucketId, httpSearchQuery, {
    enabled: !isRealtime && ready
  });
  const realtimeResult = useBucketDataRealtime(bucketId, searchQuery, isRealtime);

  return isRealtime ? realtimeResult : httpResult;
}
