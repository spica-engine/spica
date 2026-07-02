import {useState, useCallback, useEffect} from "react";
import type {BucketDataQueryType} from "../store/api/bucketApi";

const escapeForRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildBucketQuery = (searchText: string, searchableColumns: string[]) =>
  ({
    relation: true,
    limit: 25,
    filter: {
      $or: searchableColumns.map(col => ({
        [col]: {$regex: escapeForRegex(searchText), $options: "i"}
      }))
    }
  }) as const;

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


