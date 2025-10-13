import {type FC, memo, useEffect, useState, useCallback, useRef} from "react";
import styles from "./StorageFileSelect.module.scss";
import {Modal, StorageFileCard, type TypeFile, type TypeFilterValue} from "oziko-ui-kit";
import {type TypeSortProp} from "./sort-popover-content/SortPopoverContent";
import StorageModalHeading from "./storage-modal-heading/StorageModalHeading";
import StorageFileCardSkeleton from "./storage-file-card-skeleton/StorageFileCardSkeleton";
import {useGetStorageItemsQuery, type Storage, type StorageOptions} from "../../../store/api/storageApi";
import { convertQuickDateToRange, convertToBytes } from "../../../utils/storage";


type TypeStorageFileSelect = {
  className?: string;
  isOpen?: boolean;
  onClose?: () => void;
};

enum SORTS {
  NAME_DESC = "name_desc",
  NAME_ASC = "name_asc",
  DATE_DESC = "date_desc",
  DATE_ASC = "date_asc"
}

const StorageFileSelect: FC<TypeStorageFileSelect> = ({isOpen = false, onClose}) => {
  const [directory, setDirectory] = useState(["/"]);
  const [fileLength, setFileLength] = useState(0);
  const [folderLength, setFolderLength] = useState(0);
  const [data, setData] = useState<TypeFile[]>([]);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<TypeSortProp>(SORTS.NAME_ASC);
  const [activeFilter, setActiveFilter] = useState<TypeFilterValue | null>(null);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);
  const [storageOptions, setStorageOptions] = useState<StorageOptions>({});
  const [folderStorageOptions, setFolderStorageOptions] = useState<StorageOptions>({});

  const {
    data: storageResponse,
    isLoading: isStorageLoading,
    isFetching: isStorageFetching,
    refetch: refetchStorage
  } = useGetStorageItemsQuery(storageOptions, {
    skip: !hasInitialLoad && !storageOptions.filter
  });

  const {
    data: folderResponse,
    isLoading: isFolderLoading,
    isFetching: isFolderFetching,
    refetch: refetchFolders
  } = useGetStorageItemsQuery(folderStorageOptions, {
    skip: !hasInitialLoad && !folderStorageOptions.filter,
    refetchOnMountOrArgChange: 10,
    refetchOnFocus: true,
  });

  const containerRef = useRef<HTMLDivElement>(null);

  const ITEMS_PER_PAGE = 20;

  const convertStorageToTypeFile = (storage: Storage): TypeFile => ({
    _id: storage._id || "",
    name: storage.name,
    content: {
      type: storage.name.endsWith("/")
        ? "inode/directory"
        : storage.content?.type || "application/octet-stream",
      size: storage.content?.size || 0
    },
    url: storage.url || ""
  });

  const buildDirectoryFilter = useCallback(() => {
    const currentDirectory = directory.length === 1 ? "/" : directory.slice(1).join("");

    if (currentDirectory === "/") {
      return {
        $or: [
          {name: {$regex: "^[^/]+$"}},
          {name: {$regex: "^[^/]+/$"}}
        ]
      };
    } else {
      const escapedDirectory = currentDirectory.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return {
        $and: [
          {name: {$regex: `^${escapedDirectory}`}},
          {
            $or: [
              {name: {$regex: `^${escapedDirectory}[^/]+$`}},
              {name: {$regex: `^${escapedDirectory}[^/]+/$`}}
            ]
          }
        ]
      };
    }
  }, [directory]);

  const buildSearchFilter = useCallback(() => {
    return searchTerm
      ? {
          name: {$regex: searchTerm, $options: "i"}
        }
      : null;
  }, [searchTerm]);

  const buildActiveFilters = useCallback(() => {
    if (!activeFilter) return [];

    const filterConditions: any[] = [];

    if (activeFilter.type && activeFilter.type.length > 0) {
      const typeRegex = activeFilter.type.map(type => `\\.${type}$`).join("|");
      filterConditions.push({
        $and: [
          {name: {$not: {$regex: "/$"}}},
          {name: {$regex: `(${typeRegex})`, $options: "i"}}
        ]
      });
    }

    if (activeFilter.fileSize.min.value !== null || activeFilter.fileSize.max.value !== null) {
      const sizeConditions: any = {};

      if (activeFilter.fileSize.min.value !== null) {
        const minBytes = convertToBytes(
          activeFilter.fileSize.min.value,
          activeFilter.fileSize.min.unit
        );
        if (minBytes !== null) {
          sizeConditions.$gte = minBytes;
        }
      }

      if (activeFilter.fileSize.max.value !== null) {
        const maxBytes = convertToBytes(
          activeFilter.fileSize.max.value,
          activeFilter.fileSize.max.unit
        );
        if (maxBytes !== null) {
          sizeConditions.$lte = maxBytes;
        }
      }

      if (Object.keys(sizeConditions).length > 0) {
        filterConditions.push({
          $and: [
            {name: {$not: {$regex: "/$"}}},
            {"content.size": sizeConditions}
          ]
        });
      }
    }

    let dateRange = null;
    if (activeFilter.quickdate) {
      dateRange = convertQuickDateToRange(activeFilter.quickdate);
    } else if (activeFilter.dateRange.from || activeFilter.dateRange.to) {
      dateRange = {
        from: activeFilter.dateRange.from ? new Date(activeFilter.dateRange.from) : null,
        to: activeFilter.dateRange.to ? new Date(activeFilter.dateRange.to) : null
      };
    }

    if (dateRange && (dateRange.from || dateRange.to)) {
      const dateConditions: any = {};
      if (dateRange.from) {
        dateConditions.$gte = dateRange.from.toISOString();
      }
      if (dateRange.to) {
        dateConditions.$lte = dateRange.to.toISOString();
      }

      if (Object.keys(dateConditions).length > 0) {
        filterConditions.push({
          $or: [
            {createdAt: dateConditions},
            {_id: dateConditions}
          ]
        });
      }
    }

    return filterConditions;
  }, [activeFilter]);

  const buildCompleteFilter = useCallback(() => {
    const allConditions: any[] = [];

    const directoryFilter = buildDirectoryFilter();
    allConditions.push(directoryFilter);

    const searchFilter = buildSearchFilter();
    if (searchFilter) {
      allConditions.push(searchFilter);
    }

    const activeFilters = buildActiveFilters();
    if (activeFilters.length > 0) {
      allConditions.push(...activeFilters);
    }

    return allConditions.length > 1 ? {$and: allConditions} : allConditions[0] || {};
  }, [buildDirectoryFilter, buildSearchFilter, buildActiveFilters]);

  const buildSortOptions = useCallback(() => {
    const sortMap = {
      [SORTS.NAME_ASC]: {name: 1},
      [SORTS.NAME_DESC]: {name: -1},
      [SORTS.DATE_ASC]: {_id: 1},
      [SORTS.DATE_DESC]: {_id: -1}
    };

    return sortMap[sortBy];
  }, [sortBy]);

  const updateStorageOptions = useCallback(() => {
    const filter = buildCompleteFilter();
    const sort = buildSortOptions();

    const options: StorageOptions = {
      filter,
      sort,
      limit: ITEMS_PER_PAGE,
      skip: 0,
      paginate: true
    };

    const folderOptions: StorageOptions = {
      filter: {"content.type": "application/octet-stream"},
      sort,
      limit: 1,
      paginate: true
    };

    setStorageOptions(options);
    setFolderStorageOptions(folderOptions);
    setHasInitialLoad(true);
  }, [buildCompleteFilter, buildSortOptions]);

  useEffect(() => {
    if (storageResponse && isOpen) {
      const convertedData = storageResponse.data.map(convertStorageToTypeFile);
      console.log('Fetched data:', convertedData);
      if (storageOptions.skip === 0) {
        setData(convertedData);
      } else {
        setData(prev => [...prev, ...convertedData]);
      }
      
      setFileLength(storageResponse.meta.total);
      setHasNextPage(convertedData.length === ITEMS_PER_PAGE);
      setIsLoadingMore(false);
    }
  }, [isOpen, storageResponse, storageOptions.skip]);

  useEffect(() => {
    if (folderResponse) {
      setFolderLength(folderResponse.meta.total);
    }
  }, [folderResponse]);

  const loadMoreData = useCallback(async () => {
    if (!hasNextPage || isLoadingMore || !storageResponse) return;

    setIsLoadingMore(true);
    
    const newOptions: StorageOptions = {
      ...storageOptions,
      skip: data.length
    };

    setStorageOptions(newOptions);
  }, [hasNextPage, isLoadingMore, storageResponse, storageOptions, data.length]);

  const handleClickSortProp = (prop: TypeSortProp) => {
    if (sortBy !== prop) {
      setSortBy(prop);
      setData([]);
      setHasNextPage(true);
      setHasInitialLoad(false);
    }
  };

  const handleClickFile = (file: TypeFile) => {
    if (file.name.endsWith("/")) {
      const folderPath = file.name;
      setDirectory(prevDirectory => {
        if (prevDirectory.length === 1 && prevDirectory[0] === "/") {
          return ["/", folderPath];
        }
        return [...prevDirectory, folderPath];
      });
    } else {
      console.log("Selected file:", file);
    }
  };

  const handleChangeSearch = (search: string) => {
    setSearchTerm(search);
    setData([]);
    setHasNextPage(true);
    setHasInitialLoad(false);
  };

  const handleApplyFilter = (filter: TypeFilterValue) => {
    setActiveFilter(filter);
    setData([]);
    setHasNextPage(true);
    setHasInitialLoad(false);
  };

  const handleCancelFilter = () => {
  };

  const handleClearFilter = () => {
    setActiveFilter(null);
    setData([]);
    setHasNextPage(true);
    setHasInitialLoad(false);
  };

  const handleScroll = useCallback(
    (e: Event) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      const {scrollTop, scrollHeight, clientHeight} = target;
      const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100;

      if (isNearBottom && hasNextPage && !isLoadingMore && !isStorageFetching) {
        loadMoreData();
      }
    },
    [hasNextPage, isLoadingMore, isStorageFetching, loadMoreData]
  );

  const handleChangeDirectory = (index: number) => {
    setDirectory(directory.slice(0, index + 1));
    setData([]);
    setHasNextPage(true);
    setHasInitialLoad(false);
  };

  const handleClose = () => {
    setDirectory(["/"]);
    setData([]);
    setSearchTerm("");
    setHasNextPage(true);
    setActiveFilter(null);
    setHasInitialLoad(false);
    onClose?.();
  };

  useEffect(() => {
    if (isOpen && (sortBy || searchTerm || directory.length > 1 || activeFilter || !hasInitialLoad)) {
      updateStorageOptions();
    }
  }, [isOpen, sortBy, searchTerm, directory, activeFilter, updateStorageOptions, hasInitialLoad]);

  useEffect(() => {
    if (isOpen) {
      if (hasInitialLoad) {
        setHasNextPage(true);
        
        const currentOptions = {
          ...storageOptions,
          skip: 0
        };
        setStorageOptions({...currentOptions});
        setFolderStorageOptions({...folderStorageOptions});
      }
    } else {
      setData([]);
    }
  }, [isOpen]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const isLoading = isStorageLoading || isFolderLoading;
  const isFetching = isStorageFetching || isFolderFetching;



  return (
    <Modal
      isOpen={isOpen}
      showCloseButton={false}
      onClose={handleClose}
      className={styles.container}
      dimensionX="fill"
    >
      <Modal.Header
        dimensionY="hug"
        root={{
          dimensionX: "fill",
          children: (
            <StorageModalHeading
              fileLength={fileLength}
              folderLength={folderLength}
              onClickSort={handleClickSortProp}
              directory={directory}
              onChangeDirectory={handleChangeDirectory}
              onChangeSearch={handleChangeSearch}
              onApplyFilter={handleApplyFilter}
              onCancelFilter={handleCancelFilter}
              onClearFilter={handleClearFilter}
              hasActiveFilter={!!activeFilter}
            />
          )
        }}
        className={styles.header}
      />
      <Modal.Body className={styles.content} ref={containerRef}>
        {data.map(el => (
          <StorageFileCard
            onClick={() => handleClickFile(el)}
            dimensionX="fill"
            dimensionY="fill"
            key={el._id}
            file={el}
            className={styles.file}
          />
        ))}
        {(isLoadingMore || (isFetching && data.length === 0)) && (
          <>
            {[...Array(5)].map((_, index) => (
              <StorageFileCardSkeleton key={`skeleton-${index}`} className={styles.file} />
            ))}
          </>
        )}
        {!hasNextPage && data.length > 0 && !isFetching && (
          <div className={styles.endIndicator}>No more files to load</div>
        )}
        {data.length === 0 && !isLoading && !isLoadingMore && !isFetching  && (
          <div className={styles.emptyState}>No files found</div>
        )}
      </Modal.Body>
    </Modal>
  );
};

export default memo(StorageFileSelect);
