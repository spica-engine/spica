import {type FC, memo, useEffect, useState, useCallback, useRef} from "react";
import styles from "./StorageFileSelect.module.scss";
import {Modal, StorageFileCard, type TypeFile} from "oziko-ui-kit";
import {type TypeSortProp} from "./sort-popover-content/SortPopoverContent";
import StorageModalHeading from "./storage-modal-heading/StorageModalHeading";
import {useStorage, type Storage} from "../../../contexts/StorageContext";

type TypeFilterValue = {
  type: string[];
  fileSize: {
    min: {
      value: number | null;
      unit: string;
    };
    max: {
      value: number | null;
      unit: string;
    };
  };
  quickdate: string | null;
  dateRange: {
    from: null | string;
    to: null | string;
  };
};

type TypeStorageFileSelect = {
  className?: string;
  isOpen?: boolean;
  onClose?: () => void;
};

const StorageFileSelect: FC<TypeStorageFileSelect> = ({isOpen = false, onClose}) => {
  const [directory, setDirectory] = useState(["/"]);
  const [fileLength, setFileLength] = useState(0);
  const [folderLength, setFolderLength] = useState(0);
  const [data, setData] = useState<TypeFile[]>([]);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<TypeSortProp>("name_asc");
  const [activeFilter, setActiveFilter] = useState<TypeFilterValue | null>(null);

  const {getAll, loading} = useStorage();
  const containerRef = useRef<HTMLDivElement>(null);

  const ITEMS_PER_PAGE = 20;

  // Helper function to convert file size to bytes
  const convertToBytes = (value: number | null, unit: string): number | null => {
    if (value === null) return null;
    const multipliers = {
      kb: 1024,
      mb: 1024 * 1024,
      gb: 1024 * 1024 * 1024,
      tb: 1024 * 1024 * 1024 * 1024
    };
    return value * (multipliers[unit.toLowerCase() as keyof typeof multipliers] || 1);
  };

  // Helper function to convert quickdate to date range
  const convertQuickDateToRange = (
    quickdate: string | null
  ): {from: Date | null; to: Date | null} => {
    if (!quickdate) return {from: null, to: null};

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    switch (quickdate) {
      case "last_1_hour":
        return {from: new Date(now.getTime() - 60 * 60 * 1000), to: now};
      case "last_6_hour":
        return {from: new Date(now.getTime() - 6 * 60 * 60 * 1000), to: now};
      case "last_12_hour":
        return {from: new Date(now.getTime() - 12 * 60 * 60 * 1000), to: now};
      case "last_24_hour":
        return {from: new Date(now.getTime() - 24 * 60 * 60 * 1000), to: now};
      case "last_2_days":
        return {from: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), to: now};
      case "last_7_days":
        return {from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), to: now};
      case "last_14_days":
        return {from: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000), to: now};
      case "last_28_days":
        return {from: new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000), to: now};
      case "today":
        return {from: today, to: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1)};
      case "yesterday":
        return {from: yesterday, to: new Date(yesterday.getTime() + 24 * 60 * 60 * 1000 - 1)};
      case "this_week":
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        return {from: startOfWeek, to: now};
      case "last_week":
        const lastWeekStart = new Date(today);
        lastWeekStart.setDate(today.getDate() - today.getDay() - 7);
        const lastWeekEnd = new Date(lastWeekStart);
        lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
        lastWeekEnd.setHours(23, 59, 59, 999);
        return {from: lastWeekStart, to: lastWeekEnd};
      default:
        return {from: null, to: null};
    }
  };

  // Convert Storage to TypeFile format
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

  // Build directory filter based on current directory
  const buildDirectoryFilter = useCallback(() => {
    const currentDirectory = directory.length === 1 ? "/" : directory.slice(1).join("");

    if (currentDirectory === "/") {
      // At root level, show files that don't contain '/' or only one '/' at the end (folders)
      return {
        $or: [
          {name: {$regex: "^[^/]+$"}}, // Files with no slashes
          {name: {$regex: "^[^/]+/$"}} // Folders with one slash at the end
        ]
      };
    } else {
      // In a specific directory, show files that start with the current path
      // and don't have additional nested folders
      const escapedDirectory = currentDirectory.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return {
        $and: [
          {name: {$regex: `^${escapedDirectory}`}},
          {
            $or: [
              {name: {$regex: `^${escapedDirectory}[^/]+$`}}, // Direct files
              {name: {$regex: `^${escapedDirectory}[^/]+/$`}} // Direct subfolders
            ]
          }
        ]
      };
    }
  }, [directory]);

  // Build search filter
  const buildSearchFilter = useCallback(() => {
    return searchTerm
      ? {
          name: {$regex: searchTerm, $options: "i"}
        }
      : null;
  }, [searchTerm]);

  // Build active filters (type, size, date)
  const buildActiveFilters = useCallback(() => {
    if (!activeFilter) return [];

    const filterConditions: any[] = [];

    // File type filter - only apply to files, not directories
    if (activeFilter.type && activeFilter.type.length > 0) {
      const typeRegex = activeFilter.type.map(type => `\\.${type}$`).join("|");
      filterConditions.push({
        $and: [
          {name: {$not: {$regex: "/$"}}}, // Not a directory
          {name: {$regex: `(${typeRegex})`, $options: "i"}}
        ]
      });
    }

    // File size filter - only apply to files with size information
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
            {name: {$not: {$regex: "/$"}}}, // Not a directory
            {"content.size": sizeConditions}
          ]
        });
      }
    }

    // Date filter (quickdate or custom range)
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

      // Note: This assumes there's a createdAt or similar date field
      // If using _id for date filtering, the backend would need to handle ObjectId date extraction
      if (Object.keys(dateConditions).length > 0) {
        filterConditions.push({
          // Use createdAt if available, otherwise fallback to _id analysis on backend
          $or: [
            {createdAt: dateConditions},
            {_id: dateConditions} // Backend should handle ObjectId timestamp extraction
          ]
        });
      }
    }

    return filterConditions;
  }, [activeFilter, convertToBytes, convertQuickDateToRange]);

  // Build complete filter combining all conditions
  const buildCompleteFilter = useCallback(() => {
    const allConditions: any[] = [];

    // Always add directory filter
    const directoryFilter = buildDirectoryFilter();
    allConditions.push(directoryFilter);

    // Add search filter if present
    const searchFilter = buildSearchFilter();
    if (searchFilter) {
      allConditions.push(searchFilter);
    }

    // Add active filters if any exist
    const activeFilters = buildActiveFilters();
    if (activeFilters.length > 0) {
      allConditions.push(...activeFilters);
    }

    // Build final filter
    return allConditions.length > 1 ? {$and: allConditions} : allConditions[0] || {};
  }, [buildDirectoryFilter, buildSearchFilter, buildActiveFilters]);

  // Build sort options
  const buildSortOptions = useCallback(() => {
    const sortMap = {
      name_asc: {name: 1},
      name_desc: {name: -1},
      date_asc: {_id: 1}, // Using _id as date proxy
      date_desc: {_id: -1}
    };

    return sortMap[sortBy];
  }, [sortBy]);

  // Load data with pagination and filters
  const loadData = useCallback(
    async (reset = false) => {
      if ((!hasNextPage && !reset) || isLoadingMore) return;

      setIsLoadingMore(true);

      try {
        // Build complete filter using helper functions
        const filter = buildCompleteFilter();
        const sort = buildSortOptions();

        const options = {
          filter,
          sort,
          limit: ITEMS_PER_PAGE,
          skip: reset ? 0 : data.length,
          paginate: true
        };

        const optionsForFolders = {
          filter: {"content.type": "application/octet-stream"}, // veya { 'content.type': { $eq: 'application/octet-stream' } }
          sort,
          limit: 1,
          paginate: true
        };
        const response = await getAll(options);
        const folders = await getAll(optionsForFolders);
        console.log("response", response);

        const convertedData = response.data.map(convertStorageToTypeFile);

        if (reset) {
          setData(convertedData);
        } else {
          setData(prev => [...prev, ...convertedData]);
        }
        setFileLength(response.meta.total);
        setFolderLength(folders.meta.total);

        setHasNextPage(convertedData.length === ITEMS_PER_PAGE);
      } catch (error) {
        console.error("Failed to load storage data:", error);
      } finally {
        setIsLoadingMore(false);
      }
    },
    [
      buildCompleteFilter,
      buildSortOptions,
      data.length,
      hasNextPage,
      isLoadingMore,
      getAll,
      convertStorageToTypeFile
    ]
  );

  const handleClickSortProp = (prop: TypeSortProp) => {
    setSortBy(prop);
  };

  const handleClickFile = (file: TypeFile) => {
    // Check if it's a folder (name ends with '/')
    if (file.name.endsWith("/")) {
      // Navigate into the folder
      const folderPath = file.name;
      setDirectory(prevDirectory => {
        // If we're at root, just add the folder
        if (prevDirectory.length === 1 && prevDirectory[0] === "/") {
          return ["/", folderPath];
        }
        // Otherwise append to current path
        return [...prevDirectory, folderPath];
      });
    } else {
      // Handle file selection - can be extended based on requirements
      console.log("Selected file:", file);
      // You can add additional logic here for file selection
      // For example, close modal and return selected file
    }
  };

  const handleChangeSearch = (search: string) => {
    setSearchTerm(search);
  };

  const handleApplyFilter = (filter: TypeFilterValue) => {
    setActiveFilter(filter);
    // Reset data to trigger reload with new filter
    setData([]);
    setHasNextPage(true);
  };

  const handleCancelFilter = () => {
    // Filter popup will close automatically
  };

  const handleClearFilter = () => {
    setActiveFilter(null);
    setData([]);
    setHasNextPage(true);
  };

  // Infinite scroll handler
  const handleScroll = useCallback(
    (e: Event) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      const {scrollTop, scrollHeight, clientHeight} = target;
      const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100; // 100px threshold

      if (isNearBottom && hasNextPage && !isLoadingMore) {
        loadData(false);
      }
    },
    [hasNextPage, isLoadingMore, loadData]
  );

  const handleChangeDirectory = (index: number) => {
    setDirectory(directory.slice(0, index + 1));
  };

  // Handle modal close with root restart
  const handleClose = () => {
    // Reset directory to root when modal closes
    setDirectory(["/"]);
    // Reset other states to initial values
    setData([]);
    setSearchTerm("");
    setHasNextPage(true);
    setActiveFilter(null);
    // Call the original onClose callback
    onClose?.();
  };

  // Load initial data and reset when sort/search/directory/filter changes
  useEffect(() => {
    if (isOpen) {
      loadData(true);
    }
  }, [isOpen, sortBy, searchTerm, directory, activeFilter]);

  // Calculate file and folder lengths
  useEffect(() => {
    const files = data.filter(item => !item.name.endsWith("/"));
    const folders = data.filter(item => item.name.endsWith("/"));
  }, [data]);

  // Add scroll event listener for infinite scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

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
        {isLoadingMore && <div className={styles.loadingIndicator}>Loading more files...</div>}
        {!hasNextPage && data.length > 0 && (
          <div className={styles.endIndicator}>No more files to load</div>
        )}
        {data.length === 0 && !loading && !isLoadingMore && (
          <div className={styles.emptyState}>No files found</div>
        )}
      </Modal.Body>
    </Modal>
  );
};

export default memo(StorageFileSelect);
