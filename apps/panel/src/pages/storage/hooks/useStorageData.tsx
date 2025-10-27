import {useMemo} from "react";
import {useGetStorageItemsQuery} from "../../../store/api";
import type {TypeDirectories} from "src/types/storage";
import useStorage from "../../../hooks/useStorage";
import {findMaxDepthDirectory} from "../utils";

export function useStorageData(
  directory: TypeDirectories,
  apiFilter: object = {},
  searchQuery: string = "",
  isFilteringOrSearching: boolean = false
) {
  const {buildDirectoryFilter} = useStorage();

  const filterArray = [
    "/",
    ...(findMaxDepthDirectory(directory)
      ?.fullPath.split("/")
      .filter(Boolean)
      .map(i => `${i}/`) || [])
  ];

  const directoryFilter = useMemo(() => {
    if (isFilteringOrSearching) return {};
    return buildDirectoryFilter(filterArray);
  }, [filterArray, isFilteringOrSearching]);

  const searchFilter = useMemo(() => {
    if (!searchQuery) return {};

    return {
      name: {
        $regex: searchQuery,
        $options: "i"
      }
    };
  }, [searchQuery]);

  const combinedFilter = useMemo(() => {
    const filters: object[] = [];

    if (Object.keys(directoryFilter).length > 0) {
      filters.push(directoryFilter);
    }

    if (Object.keys(apiFilter).length > 0) {
      filters.push(apiFilter);
    }

    if (Object.keys(searchFilter).length > 0) {
      filters.push(searchFilter);
    }

    if (filters.length === 1) {
      return filters[0];
    }

    return {$and: filters};
  }, [directoryFilter, apiFilter, searchFilter]);

  const {
    data: storageData,
    isFetching,
    isLoading
  } = useGetStorageItemsQuery({filter: combinedFilter});

  return {storageData, isLoading: isFetching || isLoading};
}
