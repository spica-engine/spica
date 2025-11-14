
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
  setSearchResults
} from "../../../../store";
import StorageFilter, {
  createStorageFilterDefaultValues
} from "../../../../components/molecules/storage-filter/StorageFilter";
import {useLazyGetStorageItemsQuery} from "../../../../store/api/storageApi";
import useStorageService from "../../../../hooks/useStorage";
import type {DirectoryItem} from "../../../../types/storage";
import type {Storage} from "../../../../store/api/storageApi";

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

  const cloneFilter = useCallback((filter: TypeFilterValue): TypeFilterValue => ({
    type: [...filter.type],
    fileSize: {
      min: {
        value: filter.fileSize.min.value,
        unit: filter.fileSize.min.unit
      },
      max: {
        value: filter.fileSize.max.value,
        unit: filter.fileSize.max.unit
      }
    },
    quickdate: filter.quickdate,
    dateRange: {
      from: filter.dateRange.from,
      to: filter.dateRange.to
    }
  }), []);

  const hasActiveFilter = useMemo(() => {
    const defaultFilter = createStorageFilterDefaultValues();

    const sortValues = (values: string[]) => [...values].sort();
    const currentTypes = sortValues(appliedFilter.type);
    const defaultTypes = sortValues(defaultFilter.type);

    const isTypeEqual =
      currentTypes.length === defaultTypes.length &&
      currentTypes.every((value, index) => value === defaultTypes[index]);

    return !(
      isTypeEqual &&
      appliedFilter.fileSize.min.value === defaultFilter.fileSize.min.value &&
      appliedFilter.fileSize.min.unit === defaultFilter.fileSize.min.unit &&
      appliedFilter.fileSize.max.value === defaultFilter.fileSize.max.value &&
      appliedFilter.fileSize.max.unit === defaultFilter.fileSize.max.unit &&
      appliedFilter.quickdate === defaultFilter.quickdate &&
      appliedFilter.dateRange.from === defaultFilter.dateRange.from &&
      appliedFilter.dateRange.to === defaultFilter.dateRange.to
    );
  }, [appliedFilter]);

  const filterInitialValues = useMemo(() => cloneFilter(appliedFilter), [appliedFilter, cloneFilter]);

  const handleToggleFilter = () => {
    setIsFilterOpen(prev => !prev);
  };

  const handleApplyFilter = (values: TypeFilterValue) => {
    setAppliedFilter(cloneFilter(values));
    setIsFilterOpen(false);
    // TODO: integrate with API once available
  };

  const handleCancelFilter = () => {
    setIsFilterOpen(false);
  };

  const handleClearFilters = () => {
    setAppliedFilter(createStorageFilterDefaultValues());
    setIsFilterOpen(false);
    // TODO: refresh data with unfiltered version once API is available
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
