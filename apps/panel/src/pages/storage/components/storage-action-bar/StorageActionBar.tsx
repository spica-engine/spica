
import {useCallback, useEffect, useMemo, useRef, useState, type ChangeEventHandler} from "react";
import {FlexElement, FluidContainer, Icon, Button, Popover, type TypeFilterValue} from "oziko-ui-kit";
import SearchBar from "../../../../components/atoms/search-bar/SearchBar";
import styles from "./StorageActionBar.module.scss";

import CreateFolder from "../create-folder-modal/CreateFolderModal";
import {ROOT_PATH} from "../../constants";
import CreateFile from "../create-file-modal/CreateFile";
import {useAppDispatch, useAppSelector} from "../../../../store/hook";
import {
  selectDirectory,
  selectCurrentDirectory,
  selectSearchQuery,
  setSearchQuery,
  setSearchResults,
  setFilterQuery
} from "../../../../store";
import StorageFilter from "../../../../components/molecules/storage-filter/StorageFilter";
import {useLazyGetStorageItemsQuery} from "../../../../store/api/storageApi";
import useStorageService from "../../../../hooks/useStorage";
import type {DirectoryItem} from "../../../../types/storage";
import type {Storage} from "../../../../store/api/storageApi";
import {
  buildStorageFilterQuery,
  cloneStorageFilterValues,
  createStorageFilterDefaultValues,
  isDefaultStorageFilter
} from "../../../../utils/storageFilter";

const SEARCH_DEBOUNCE_MS = 300;
const MIN_SEARCH_LENGTH = 3;

export default function StorageActionBar() {
  const dispatch = useAppDispatch();
  const directory = useAppSelector(selectDirectory);
  const currentDirectory = useAppSelector(selectCurrentDirectory);
  const searchQuery = useAppSelector(selectSearchQuery);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [appliedFilter, setAppliedFilter] = useState<TypeFilterValue>(createStorageFilterDefaultValues());
  const [triggerSearch, {isFetching: isSearchFetching}] = useLazyGetStorageItemsQuery();
  const {convertStorageToTypeFile} = useStorageService();
  const latestSearchRef = useRef("");
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trimmedSearch = searchQuery.trim();
  const isSearchEligible = trimmedSearch.length >= MIN_SEARCH_LENGTH;

  const handleSearchChange = useCallback<ChangeEventHandler<HTMLInputElement>>(
    event => {
      dispatch(setSearchQuery(event.target.value));
    },
    [dispatch]
  );

  const hasActiveFilter = useMemo(() => !isDefaultStorageFilter(appliedFilter), [appliedFilter]);

  const filterInitialValues = useMemo(() => cloneStorageFilterValues(appliedFilter), [appliedFilter]);

  const handleToggleFilter = () => {
    setIsFilterOpen(prev => !prev);
  };

  const handleApplyFilter = (values: TypeFilterValue) => {
    const clonedFilter = cloneStorageFilterValues(values);
    setAppliedFilter(clonedFilter);
    setIsFilterOpen(false);

    const filterQuery = buildStorageFilterQuery(clonedFilter);
    dispatch(setFilterQuery(filterQuery));
  };

  const handleCancelFilter = () => {
    setIsFilterOpen(false);
  };

  const handleClearFilters = () => {
    setAppliedFilter(createStorageFilterDefaultValues());
    setIsFilterOpen(false);
    dispatch(setFilterQuery(null));
  };

  const convertSearchResults = useCallback(
    (items: Storage[], query: string): DirectoryItem[] => {
      const normalizedQuery = query.toLowerCase();

      return items
        .map(item => {
          const typeFile = convertStorageToTypeFile(item);
          const isDirectory = typeFile.content?.type === "inode/directory";
          const pathSegments = (item.name || "").split("/").filter(Boolean);
          const baseName = pathSegments.at(-1) || item.name || "";
          const label = isDirectory ? `${baseName}/` : baseName;

          return {
            ...typeFile,
            label,
            fullPath: item.name,
            currentDepth: 1,
            isActive: false,
            items: undefined
          };
        })
        .filter(item => {
          const baseLabel = (item.label || item.name || "").replace(/\/$/, "").toLowerCase();
          return baseLabel.includes(normalizedQuery);
        });
    },
    [convertStorageToTypeFile]
  );

  const escapeForRegex = useCallback((value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), []);

  useEffect(() => {
    const trimmedQuery = searchQuery.trim();
    latestSearchRef.current = trimmedQuery;

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    if (!trimmedQuery || trimmedQuery.length < MIN_SEARCH_LENGTH) {
      dispatch(setSearchResults([]));
      return;
    }

    let isCancelled = false;

    const timeoutId = setTimeout(async () => {
      try {
        const response = await triggerSearch({
          filter: {
            name: {
              $regex: escapeForRegex(trimmedQuery),
              $options: "i"
            }
          },
          limit: 50,
          paginate: true
        }).unwrap();

        if (isCancelled || latestSearchRef.current !== trimmedQuery) {
          return;
        }

        const filteredResults = convertSearchResults(response.data, trimmedQuery);
        dispatch(setSearchResults(filteredResults));
      } catch (error) {
        if (!isCancelled && latestSearchRef.current === trimmedQuery) {
          dispatch(setSearchResults([]));
          console.error("Storage search failed:", error);
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    debounceTimeoutRef.current = timeoutId;

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [searchQuery, triggerSearch, dispatch, convertSearchResults, escapeForRegex]);
  
  const visibleDirectories = directory
    .filter(dir => dir.currentDepth)
    .sort((a, b) => (a.currentDepth || 0) - (b.currentDepth || 0));
  
  const currentItemNames = visibleDirectories
    .flatMap(dir => dir.items?.map(item => item.name).filter(Boolean) || []);

  const prefix =
    !currentDirectory || currentDirectory === ROOT_PATH
      ? ""
      : currentDirectory.split("/").filter(Boolean).join("/") + "/";

  return (
    <FluidContainer
      className={styles.actionBar}
      prefix={{
        children: <FlexElement>
          <SearchBar
            loading={isSearchEligible && isSearchFetching}
            inputProps={{
              value: searchQuery,
              onChange: handleSearchChange
            }}
          />
          <FlexElement alignment="center" gap={10}>
            <Popover
              open={isFilterOpen}
              onClose={() => setIsFilterOpen(false)}
              placement="bottom"
              content={
                <StorageFilter
                  initialValues={filterInitialValues}
                  onApply={handleApplyFilter}
                  onCancel={handleCancelFilter}
                />
              }
            >
              <Button variant="text" onClick={handleToggleFilter} color={hasActiveFilter ? "primary" : undefined}>
                <Icon name="filter" size="sm" />
                Filter
                {hasActiveFilter && <Icon name="check" size="sm" />}
              </Button>
            </Popover>
            {hasActiveFilter && (
              <Button variant="text" onClick={handleClearFilters}>
                <Icon name="close" size="sm" />
                Clear Filters
              </Button>
            )}
          </FlexElement>
        </FlexElement>
      }}
      suffix={{
        children: (
          <FlexElement>
            <Button className={styles.actionBarButton} variant="filled">
              <Icon name="sort" />
              Sort
            </Button>
            <Button className={styles.actionBarButton} variant="filled">
              <Icon name="refresh" />
              Refresh
            </Button>
            <CreateFile prefix={prefix} className={styles.actionBarButton}/>
            <CreateFolder prefix={prefix} forbiddenNames={currentItemNames} buttonClassName={styles.actionBarButton}/>
          </FlexElement>
        )
      }}
    />
  );
}
