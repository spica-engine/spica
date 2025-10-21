import {useState, useCallback, useEffect} from "react";
import type {BucketDataQueryWithIdType} from "../services/bucketService";

const escapeForRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildBucketQuery = (searchText: string, searchableColumns: string[]) =>
  ({
    paginate: true,
    relation: true,
    limit: 25,
    filter: {
      $or: searchableColumns.map(col => ({
        [col]: {$regex: escapeForRegex(searchText), $options: "i"}
      }))
    }
  }) as const;

interface UseBucketSearchResult {
  searchQuery: BucketDataQueryWithIdType | undefined;
  handleSearch: (search: string) => Promise<void>;
}

export function useBucketSearch(
  bucketId: string,
  searchableColumns: string[]
): UseBucketSearchResult {
  const [searchQuery, setSearchQuery] = useState<BucketDataQueryWithIdType | undefined>();

  useEffect(() => {
    setSearchQuery(undefined);
  }, [bucketId]);

  const handleSearch = useCallback(
    async (search: string) => {
      const trimmed = search.trim();
      const query = trimmed === "" ? undefined : buildBucketQuery(trimmed, searchableColumns);
      setSearchQuery(query ? {bucketId: bucketId!, ...query} : undefined);
    },
    [bucketId, searchableColumns]
  );

  return {
    searchQuery,
    handleSearch
  };
}


