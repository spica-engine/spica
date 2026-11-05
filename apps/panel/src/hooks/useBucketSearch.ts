import {useState, useCallback, useEffect, useMemo} from "react";
import {isFieldPath} from "../components/prefabs/filter-panel/filterPanelUtils";
import type {BucketDataQueryType} from "../store/api/bucketApi";
import type {DataEngine} from "../store/api/statusApi";

const escapeForRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const buildBucketQuery = (
  searchText: string,
  searchableColumns: string[],
  engine?: DataEngine
): BucketDataQueryType => {
  const base: BucketDataQueryType = {
    paginate: true,
    relation: true,
    limit: 25
  };

  // MongoDB rejects an empty `$or: []` and returns nothing, so a bucket with no
  // text-searchable columns must omit the filter entirely rather than emit one.
  if (!searchableColumns.length) return base;

  if (engine === "postgresql") {
    const columns = searchableColumns.filter(isFieldPath);
    if (!columns.length) return base;
    const pattern = JSON.stringify(escapeForRegex(searchText));
    return {
      ...base,
      filter: columns.map(col => `regex(document.${col}, ${pattern}, "i")`).join(" || ")
    };
  }

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
  searchableColumns: string[],
  engine?: DataEngine
): UseBucketSearchResult {
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    setSearchText("");
  }, [bucketId]);

  const handleSearch = useCallback(async (search: string) => {
    setSearchText(search.trim());
  }, []);

  const searchQuery = useMemo(
    () =>
      searchText && bucketId ? buildBucketQuery(searchText, searchableColumns, engine) : undefined,
    [searchText, bucketId, searchableColumns, engine]
  );

  return {
    searchQuery,
    handleSearch
  };
}
