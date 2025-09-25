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
      type: storage.name.endsWith('/') ? "inode/directory" : (storage.content?.type || "application/octet-stream"),
      size: storage.content?.size || 0
    },
    url: storage.url || ""
  });
  
  // Load data with pagination and filters
  const loadData = useCallback(async (reset = false) => {
    if ((!hasNextPage && !reset) || isLoadingMore) return;
    
    setIsLoadingMore(true);
    
    try {
      // Build current directory path correctly
      const currentDirectory = directory.length === 1 ? "/" : directory.slice(1).join("");
      console.log("Current directory:", currentDirectory, "Directory array:", directory);
      let directoryFilter = {};
      
      if (currentDirectory === "/") {
        // At root level, show files that don't contain '/' or only one '/' at the end (folders)
        directoryFilter = {
          $or: [
            { name: { $regex: "^[^/]+$" } }, // Files with no slashes
            { name: { $regex: "^[^/]+/$" } } // Folders with one slash at the end
          ]
        };
      } else {
        // In a specific directory, show files that start with the current path
        // and don't have additional nested folders
        const escapedDirectory = currentDirectory.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        directoryFilter = {
          $and: [
            { name: { $regex: `^${escapedDirectory}` } },
            {
              $or: [
                { name: { $regex: `^${escapedDirectory}[^/]+$` } }, // Direct files
                { name: { $regex: `^${escapedDirectory}[^/]+/$` } } // Direct subfolders
              ]
            }
          ]
        };
      }
      
      const searchFilter = searchTerm ? {
        name: { $regex: searchTerm, $options: "i" }
      } : {};
      
      const filter = {
        ...directoryFilter,
        ...searchFilter
      };
      
      console.log("Applied filter:", JSON.stringify(filter, null, 2));
      
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
    // Check if it's a folder (name ends with '/')
    if (file.name.endsWith('/')) {
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

  // Handle modal close with root restart
  const handleClose = () => {
    // Reset directory to root when modal closes
    setDirectory(["/"]);
    // Reset other states to initial values
    setData([]);
    setSearchTerm("");
    setHasNextPage(true);
    // Call the original onClose callback
    onClose?.();
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
    <Modal isOpen={isOpen} showCloseButton={false} onClose={handleClose} className={styles.container} dimensionX="fill">
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
