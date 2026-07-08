import {useState, useCallback, useEffect} from "react";
import type {BucketDataQueryType} from "../store/api/bucketApi";

const escapeForRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildBucketQuery = (searchText: string, searchableColumns: string[]): BucketDataQueryType => {
  const base: BucketDataQueryType = {
    paginate: true,
    relation: true,
    limit: 25
  };

  // MongoDB rejects an empty `$or: []` and returns nothing, so a bucket with no
  // text-searchable columns must omit the filter entirely rather than emit one.
  if (!searchableColumns.length) return base;

  return {
    ...base,
    filter: {
      $or: searchableColumns.map(col => ({
        [col]: {$regex: escapeForRegex(searchText), $options: "i"}
      }))
    }
  };
};

interface UseBucketSearchResult {
  searchQuery: BucketDataQueryType | undefined;
  handleSearch: (search: string) => Promise<void>;
}

export function useBucketSearch(
  bucketId: string,
  searchableColumns: string[]
): UseBucketSearchResult {
  const [searchQuery, setSearchQuery] = useState<BucketDataQueryType | undefined>();

  useEffect(() => {
    setSearchQuery(undefined);
  }, [bucketId]);

  const handleSearch = useCallback(
    async (search: string) => {
      const trimmed = search.trim();
      const query = trimmed === "" ? undefined : buildBucketQuery(trimmed, searchableColumns);
      setSearchQuery(query && bucketId ? query : undefined);
    },
    [bucketId, searchableColumns]
  );

  return {
    searchQuery,
    handleSearch
  };
}


