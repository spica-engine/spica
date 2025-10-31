import {useEffect, useMemo, useState} from "react";
import type {TypeDirectories} from "src/types/storage";
import useStorage from "../../../hooks/useStorage";
import {findMaxDepthDirectory} from "../utils";
import {
  useLazyBrowseStorageQuery,
  useLazyGetStorageItemsQuery
} from "../../../store/api/storageApi";
import {ROOT_PATH} from "../constants";

export function useStorageData(
  directory: TypeDirectories,
  apiFilter: object = {},
  searchQuery: string = "",
  isFilteringOrSearching: boolean = false
) {
  const [filteredData, setFilteredData] = useState<Storage[]>([]);
  const {buildDirectoryFilter} = useStorage();
  const dirToFetch = findMaxDepthDirectory(directory) ?? directory[0];
  const [
    fetchFilteredData,
    {isLoading: isFilteredDataLoading, isFetching: isFilteredDataFetching}
  ] = useLazyGetStorageItemsQuery();

  const path = useMemo(() => {
    if (!dirToFetch) return "";
    if (dirToFetch.fullPath === ROOT_PATH) return "";
    return dirToFetch.fullPath.split("/").filter(Boolean).join("/");
  }, [dirToFetch?.fullPath]);

  const [
    fetchUnfilteredData,
    {
      data: unfilteredData,
      isLoading: isUnfilteredDataLoading,
      isFetching: isUnfilteredDataFetching,
      error
    }
  ] = useLazyBrowseStorageQuery();

  const filterArray = useMemo(
    () => [
      "/",
      ...(findMaxDepthDirectory(directory)
        ?.fullPath.split("/")
        .filter(Boolean)
        .map(i => `${i}/`) || [])
    ],
    [directory]
  );

  const directoryFilter = useMemo(() => {
    if (isFilteringOrSearching) return {};
    return buildDirectoryFilter(filterArray);
  }, [filterArray, isFilteringOrSearching]);

  const searchFilter = useMemo(() => {
    if (!searchQuery) return {};

    const safeQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = `^(?:[^/]*${safeQuery}[^/]*|.*\\/[^/]*${safeQuery}[^/]*)$`;

    return {
      name: {
        $regex: pattern,
        $options: "i"
      }
    };
  }, [searchQuery]);

  const filter = useMemo(() => {
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

  useEffect(() => {
    if (isFilteringOrSearching) return;
    fetchUnfilteredData({path});
  }, [directoryFilter, fetchUnfilteredData, isFilteringOrSearching, path]);

  useEffect(() => {
    if (!isFilteringOrSearching) return;
    const fetchData = async () => {
      const {data} = await fetchFilteredData({filter});
      setFilteredData(data as unknown as Storage[]);
    };
    fetchData();
  }, [isFilteringOrSearching, apiFilter, searchQuery]);

  return {
    storageData: isFilteringOrSearching ? filteredData : unfilteredData,
    isLoading:
      isFilteredDataLoading ||
      isUnfilteredDataLoading ||
      isFilteredDataFetching ||
      isUnfilteredDataFetching,
    error
  };
}
