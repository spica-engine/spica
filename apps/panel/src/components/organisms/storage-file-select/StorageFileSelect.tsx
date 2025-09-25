import {type FC, memo, useEffect, useState, useCallback, useRef} from "react";
import styles from "./StorageFileSelect.module.scss";
import {Modal, StorageFileCard, type TypeFile} from "oziko-ui-kit";
import {type TypeSortProp} from "./sort-popover-content/SortPopoverContent";
import StorageModalHeading from "./storage-modal-heading/StorageModalHeading";
import {useStorage, type Storage} from "../../../contexts/StorageContext";


type TypeStorageFileSelect = {
  className?: string;
  isOpen?: boolean;
  onClose?: () => void;
};

const StorageFileSelect: FC<TypeStorageFileSelect> = ({
  isOpen = false,
  onClose
}) => {
  const [directory, setDirectory] = useState(["/"]);
  const [fileLength, setFileLength] = useState(0);
  const [folderLength, setFolderLength] = useState(0);
  const [data, setData] = useState<TypeFile[]>([]);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<TypeSortProp>("name_asc");
  
  const { getAll, loading } = useStorage();
  const containerRef = useRef<HTMLDivElement>(null);
  
  const ITEMS_PER_PAGE = 20;
  
  // Convert Storage to TypeFile format
  const convertStorageToTypeFile = (storage: Storage): TypeFile => ({
    _id: storage._id || "",
    name: storage.name,
    content: {
      type: storage.content?.type || "application/octet-stream",
      size: storage.content?.size || 0
    },
    url: storage.url || ""
  });
  
  // Load data with pagination and filters
  const loadData = useCallback(async (reset = false) => {
    if ((!hasNextPage && !reset) || isLoadingMore) return;
    
    setIsLoadingMore(true);
    
    try {
      const currentDirectory = directory.join("");
      const directoryFilter = currentDirectory === "/" ? {} : {
        name: { $regex: `^${currentDirectory}` }
      };
      
      const searchFilter = searchTerm ? {
        name: { $regex: searchTerm, $options: "i" }
      } : {};
      
      const filter = {
        ...directoryFilter,
        ...searchFilter
      };
      
      const sortMap = {
        name_asc: { name: 1 },
        name_desc: { name: -1 },
        date_asc: { _id: 1 }, // Using _id as date proxy
        date_desc: { _id: -1 }
      };
      
      const options = {
        filter,
        sort: sortMap[sortBy],
        limit: ITEMS_PER_PAGE,
        skip: reset ? 0 : data.length,
        paginate: true
      };
      
      const response = await getAll(options);
      const convertedData = response.data.map(convertStorageToTypeFile);
      
      if (reset) {
        setData(convertedData);
      } else {
        setData(prev => [...prev, ...convertedData]);
      }
      
      setHasNextPage(convertedData.length === ITEMS_PER_PAGE);
    } catch (error) {
      console.error("Failed to load storage data:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [directory, searchTerm, sortBy, data.length, hasNextPage, isLoadingMore, getAll]);
  
  const handleClickSortProp = (prop: TypeSortProp) => {
    setSortBy(prop);
  };

  const handleClickFile = (file: TypeFile) => {
    // Handle file selection - can be extended based on requirements
    console.log("Selected file:", file);
  };
  
  const handleChangeSearch = (search: string) => {
    setSearchTerm(search);
  };
  
  // Infinite scroll handler
  const handleScroll = useCallback((e: Event) => {
    const target = e.target as HTMLElement;
    if (!target) return;
    
    const { scrollTop, scrollHeight, clientHeight } = target;
    const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100; // 100px threshold
    
    if (isNearBottom && hasNextPage && !isLoadingMore) {
      loadData(false);
    }
  }, [hasNextPage, isLoadingMore, loadData]);

  const handleChangeDirectory = (index: number) => {
    setDirectory(directory.slice(0, index + 1));
  };

  // Load initial data and reset when sort/search/directory changes
  useEffect(() => {
    if (isOpen) {
      loadData(true);
    }
  }, [isOpen, sortBy, searchTerm, directory]);
  
  // Calculate file and folder lengths
  useEffect(() => {
    const files = data.filter(item => !item.name.endsWith('/'));
    const folders = data.filter(item => item.name.endsWith('/'));
    setFileLength(files.length);
    setFolderLength(folders.length);
  }, [data]);
  
  // Add scroll event listener for infinite scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  return (
    <Modal isOpen={isOpen} showCloseButton={false} onClose={onClose} className={styles.container} dimensionX="fill">
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
            />
          )
        }}
      />
      <Modal.Body gap={12} className={styles.content} ref={containerRef}>
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
        {isLoadingMore && (
          <div className={styles.loadingIndicator}>
            Loading more files...
          </div>
        )}
        {!hasNextPage && data.length > 0 && (
          <div className={styles.endIndicator}>
            No more files to load
          </div>
        )}
        {data.length === 0 && !loading && !isLoadingMore && (
          <div className={styles.emptyState}>
            No files found
          </div>
        )}
      </Modal.Body>
    </Modal>
  );
};

export default memo(StorageFileSelect);
