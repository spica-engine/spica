import {
  FlexElement,
  FluidContainer,
  Icon,
  type TypeAlignment,
  Text,
  type TypeFile,
  Button,
  type TypeFluidContainer,
  Spinner
} from "oziko-ui-kit";
import styles from "./Storage.module.scss";
import {useGetStorageItemsQuery} from "../../store/api";
import {useUploadFilesMutation} from "../../store/api/storageApi";
import {memo, useEffect, useMemo, useState, type DragEventHandler} from "react";
import useStorage from "../../hooks/useStorage";
import useFileView from "../../hooks/useFileView";
import SearchBar from "../../components/atoms/search-bar/SearchBar";

type TypeDirectoryDepth = 1 | 2 | 3;
type TypeDirectory = {
  items?: TypeFile[];
  label: string;
  fullPath: string;
  currentDepth?: TypeDirectoryDepth;
  isActive: boolean;
  content: {
    type: string;
    size: number;
  };
};
type TypeDirectories = TypeDirectory[];

interface FilePreviewProps {
  handleClosePreview: () => void;
  previewFile?: TypeFile;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);

  return `${parseFloat(value.toFixed(2))} ${units[i]}`;
}

const FilePreview = memo(({handleClosePreview, previewFile}: FilePreviewProps) => {
  const fileView = useFileView({file: previewFile});
  const isImage = previewFile?.content?.type.startsWith("image/");
  const timestamp = parseInt(previewFile?._id.substring(0, 8) || "0", 16) * 1000;
  const createdAt = new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });

  return (
    <FluidContainer
      className={styles.filePreviewContent}
      gap={10}
      direction="vertical"
      dimensionY="fill"
      root={{
        children: (
          <FlexElement gap={10} direction="vertical">
            <FluidContainer
              dimensionX="fill"
              alignment="rightCenter"
              suffix={{
                children: (
                  <Button
                    className={styles.closePreviewButton}
                    variant="icon"
                    onClick={handleClosePreview}
                  >
                    <Icon name="close" />
                  </Button>
                )
              }}
            />
            <FlexElement className={styles.fileView}>{fileView}</FlexElement>
          </FlexElement>
        ),
        className: styles.fileViewContainer
      }}
      suffix={{
        className: styles.metadata,
        children: (
          <FlexElement direction="vertical" className={styles.metadataContent}>
            <FlexElement direction="vertical" gap={10}>
              <Text className={styles.metadataName}>
                {previewFile?.name} - {formatFileSize(previewFile?.content?.size || 0)}
              </Text>
              <Text>{previewFile?.content?.type}</Text>
              <Text>{createdAt.toLocaleString()}</Text>
            </FlexElement>
            <FlexElement gap={10}>
              <Button className={styles.metadataButton} variant="text">
                <Icon name="fileMultiple" size={14} />
                Copy
              </Button>
              {isImage && (
                <Button className={styles.metadataButton} variant="text">
                  <Icon name="pencil" size={14} />
                  Edit
                </Button>
              )}
              <Button className={styles.metadataButton} variant="text">
                <Icon name="swapHorizontal" size={14} />
                Replace
              </Button>
              <Button
                className={`${styles.metadataButton} ${styles.metadataClearButton}`}
                color="danger"
              >
                <Icon name="delete" size={14} />
                Delete
              </Button>
            </FlexElement>
          </FlexElement>
        )
      }}
    />
  );
});

interface StorageItemColumnProps {
  items?: TypeFile[];
  handleFolderClick: (
    folderName: string,
    fullPath: string,
    depth: TypeDirectoryDepth,
    isActive: boolean
  ) => void;
  setPreviewFile: (file?: TypeFile) => void;
  depth: TypeDirectoryDepth;
  directory: TypeDirectories;
  previewFileId?: string;
  prefix: string;
  onUploadComplete: (file: TypeFile & {prefix?: string}) => void;
}

const StorageItemColumn = memo(
  ({
    items,
    handleFolderClick,
    setPreviewFile,
    depth,
    directory,
    previewFileId,
    prefix,
    onUploadComplete
  }: StorageItemColumnProps) => {
    const [uploadFiles] = useUploadFilesMutation();

    const orderedItems = useMemo(() => {
      if (!items) return [];
      const folders = items
        .filter(item => item.content.type === "inode/directory")
        .sort((a, b) => a.name.localeCompare(b.name));
      const files = items
        .filter(item => item.content.type !== "inode/directory")
        .sort((a, b) => a.name.localeCompare(b.name));
      return [...folders, ...files];
    }, [items]);

    const handleDragOver: DragEventHandler<HTMLDivElement> = e => {
      e.preventDefault();
    };

    const handleDrop: DragEventHandler<HTMLDivElement> = async e => {
      e.preventDefault();
      const files = e.dataTransfer.files;

      if (files && files.length > 0) {
        try {
          const filesWithPrefix = Array.from(files).map(file => {
            const fileName = prefix + file.name;
            const encodedFileName = encodeURIComponent(fileName);
            return new File([file], encodedFileName, {type: file.type});
          });

          const dataTransfer = new DataTransfer();
          filesWithPrefix.forEach(file => dataTransfer.items.add(file));

          const response = await uploadFiles({files: dataTransfer.files});
          const uploadedFile = (response as any)?.data?.[0] as TypeFile | undefined;
          if (uploadedFile) {
            onUploadComplete({...uploadedFile, prefix});
          }
        } catch (error) {
          console.error("File upload failed:", error);
        }
      }
    };

    return (
      <FlexElement
        className={styles.storageItemColumn}
        direction="vertical"
        alignment={"left" as TypeAlignment}
        gap={10}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {orderedItems?.map((item, index) => {
          const isFolder = item?.content?.type === "inode/directory";
          const fullPath = item.name;
          const isActive = isFolder
            ? directory.find(i => i.fullPath === fullPath)?.isActive || false
            : previewFileId === item._id;

          return (
            <StorageItem
              key={index}
              item={item}
              onFolderClick={folderName => handleFolderClick(folderName, fullPath, depth, isActive)}
              onFileClick={setPreviewFile}
              isActive={isActive}
            />
          );
        })}
      </FlexElement>
    );
  }
);

interface StorageItemProps {
  item: TypeFile | TypeDirectory;
  onFolderClick?: (folderName: string) => void;
  onFileClick: (file?: TypeFile) => void;
  isActive: boolean;
}

const StorageItem = memo(({item, onFolderClick, onFileClick, isActive}: StorageItemProps) => {
  const itemName = (item as TypeDirectory).label || (item as TypeFile).name;
  const isFolder = item?.content?.type === "inode/directory";
  const handleFolderClick = () => onFolderClick?.(itemName);
  const handleFileClick = () => onFileClick(isActive ? undefined : (item as TypeFile));
  return (
    <FlexElement
      onClick={isFolder ? handleFolderClick : handleFileClick}
      className={`${styles.storageItem} ${isFolder ? styles.folder : styles.file} ${isActive ? styles.activeStorageItem : ""}`}
      gap={10}
    >
      <Icon
        name={isFolder ? "folder" : "fileDocument"}
        size={14}
        className={styles.storageItemIcon}
      />
      <Text className={styles.storageItemText} size="medium">
        {isFolder ? itemName.slice(0, -1) : itemName}
      </Text>
    </FlexElement>
  );
});

const ActionButtons = memo(() => {
  return (
    <FlexElement>
      <Button className={styles.actionBarButton} variant="filled">
        <Icon name="sort" />
        Sort
      </Button>
      <Button className={styles.actionBarButton} variant="filled">
        <Icon name="refresh" />
        Refresh
      </Button>
      <Button className={styles.actionBarButton} variant="filled">
        <Icon name="plus" />
        Upload Files
      </Button>
      <Button className={styles.actionBarButton} variant="filled">
        <Icon name="plus" />
        Create New Folder
      </Button>
    </FlexElement>
  );
});

interface StorageItemColumnsProps {
  handleFolderClick: (
    folderName: string,
    fullPath: string,
    depth: TypeDirectoryDepth,
    isActive: boolean
  ) => void;
  setPreviewFile: (file?: TypeFile) => void;
  directory: TypeDirectories;
  previewFile?: TypeFile;
  onUploadComplete: (file: TypeFile & {prefix?: string}) => void;
}

const StorageItemColumns = memo(
  ({
    handleFolderClick,
    setPreviewFile,
    directory,
    previewFile,
    onUploadComplete
  }: StorageItemColumnsProps) => {
    const columns = [1, 2, 3] as TypeDirectoryDepth[];
    return (
      <FluidContainer
        dimensionY="fill"
        dimensionX="fill"
        gap={0}
        {...columns.reduce((acc, depth) => {
          const currentDirectory = directory.find(dir => dir.currentDepth === depth);
          if (!currentDirectory) return acc;
          const items = currentDirectory?.items;

          let key: string;
          switch (depth) {
            case 1:
              key = "prefix";
              break;
            case 2:
              key = "root";
              break;
            case 3:
              key = "suffix";
              break;
            default:
              key = "";
          }

          const prefix =
            currentDirectory.fullPath === "/"
              ? ""
              : currentDirectory.fullPath.split("/").filter(Boolean).join("/") + "/";

          acc[key as keyof TypeFluidContainer] = {
            className: styles.storageItemColumnContainer,
            children: items ? (
              <StorageItemColumn
                items={items}
                handleFolderClick={handleFolderClick}
                setPreviewFile={setPreviewFile}
                depth={depth}
                directory={directory}
                previewFileId={previewFile?._id}
                prefix={prefix}
                onUploadComplete={onUploadComplete}
              />
            ) : (
              <div className={styles.columnLoaderContainer}>
                <Spinner />
              </div>
            )
          };
          return acc;
        }, {} as TypeFluidContainer)}
      />
    );
  }
);

const ROOT_PATH = "/";
const getParentPath = (fullPath: string) => {
  const res =
    fullPath.replace(/\/[^/]+\/?$/, "") === fullPath
      ? "/"
      : fullPath.replace(/\/[^/]+\/?$/, "") || "/";
  return res === "/" ? res : res + "/";
};

function findMaxDepthDirectory<T extends {currentDepth?: number}>(arr: T[]): T | undefined {
  return arr.reduce<T | undefined>((max, obj) => {
    if (obj.currentDepth === undefined) return max;
    if (!max || max.currentDepth === undefined || obj.currentDepth > max.currentDepth) return obj;
    return max;
  }, undefined);
}

export default function StoragePage() {
  const [directory, setDirectory] = useState<TypeDirectories>([
    {
      items: undefined,
      label: "",
      fullPath: ROOT_PATH,
      currentDepth: 1,
      isActive: true,
      content: {type: "inode/directory", size: 0}
    }
  ]);
  const {buildDirectoryFilter, convertStorageToTypeFile} = useStorage();
  const filterArray = [
    "/",
    ...(findMaxDepthDirectory(directory)
      ?.fullPath.split("/")
      .filter(Boolean)
      .map(i => `${i}/`) || [])
  ];
  const filter = useMemo(() => buildDirectoryFilter(filterArray), [filterArray]);
  const {data: storageData} = useGetStorageItemsQuery({filter});
  const [previewFile, setPreviewFile] = useState<TypeFile>();

  const handleFolderClick = (
    folderName: string,
    fullPath: string,
    directoryDepth: TypeDirectoryDepth,
    wasActive: boolean
  ) => {
    handleClosePreview();

    if (wasActive) {
      const cleanDirectories = directory.map(dir => ({
        ...dir,
        isActive: false,
        currentDepth: undefined
      }));
      const dirToChange = findMaxDepthDirectory(directory);
      const newDirectories = cleanDirectories.map(dir => {
        if (dir.fullPath === getParentPath(dirToChange?.fullPath!)) {
          return {...dir, isActive: true, currentDepth: dirToChange?.currentDepth};
        } else if (dir.fullPath === getParentPath(getParentPath(dirToChange?.fullPath!))) {
          const newDepth = (dirToChange?.currentDepth! - 1) as TypeDirectoryDepth;
          return {...dir, isActive: true, currentDepth: newDepth > 0 ? newDepth : undefined};
        }
        return dir;
      });
      setDirectory(newDirectories);
      return;
    }

    const depthToGive = Math.min(directoryDepth + 1, 3) as TypeDirectoryDepth;
    let theDirectory = directory.find(dir => dir.fullPath === fullPath);
    if (!theDirectory) {
      theDirectory = {
        items: undefined,
        label: folderName,
        fullPath: fullPath,
        currentDepth: depthToGive,
        isActive: true,
        content: {type: "inode/directory", size: 0}
      };
    } else {
      theDirectory = {...theDirectory, currentDepth: depthToGive, isActive: true};
    }
    const cleanDirectories = directory.map(dir => ({
      ...dir,
      isActive: false,
      currentDepth: undefined
    }));
    const newDirectories = cleanDirectories.map(dir => {
      if (getParentPath(theDirectory.fullPath) === dir.fullPath) {
        const newDepth = (theDirectory!.currentDepth! - 1) as TypeDirectoryDepth;
        return {...dir, isActive: newDepth > 0, currentDepth: newDepth > 0 ? newDepth : undefined};
      } else if (getParentPath(getParentPath(theDirectory.fullPath)) === dir.fullPath) {
        const newDepth = (theDirectory!.currentDepth! - 2) as TypeDirectoryDepth;
        return {...dir, isActive: newDepth > 0, currentDepth: newDepth > 0 ? newDepth : undefined};
      } else if (dir.fullPath === theDirectory!.fullPath) {
        return theDirectory!;
      }
      return dir;
    });
    if (!newDirectories.find(dir => dir.fullPath === theDirectory.fullPath)) {
      newDirectories.push(theDirectory);
    }
    setDirectory(newDirectories);
  };

  const convertData = (data: TypeFile[]) => {
    const convertedData = data?.map(storage => {
      const typeFile = convertStorageToTypeFile(storage);
      const nameParts = typeFile.name.split("/").filter(Boolean);
      const isFolder = typeFile.content.type === "inode/directory";
      const resolvedName = nameParts[nameParts.length - 1] + (isFolder ? "/" : "");

      return {
        ...typeFile,
        items: undefined,
        label: resolvedName,
        fullPath: storage.name,
        currentDepth: Math.min(directory.filter(dir => dir.currentDepth).length, 3),
        isActive: false
      };
    });
    return convertedData;
  };

  useEffect(() => {
    const data = storageData?.data ?? (storageData as unknown as TypeFile[]);
    const convertedData = convertData(data as TypeFile[]);
    if (!convertedData) return;
    let newDirectories = [...directory];
    const dirToChange = findMaxDepthDirectory(newDirectories) ?? newDirectories[0];
    if (dirToChange) {
      newDirectories = newDirectories.map(i =>
        i.fullPath === dirToChange.fullPath ? {...i, items: convertedData} : i
      );
    }
    setDirectory(newDirectories);
  }, [storageData]);

  const handleClosePreview = () => setPreviewFile(undefined);

  const onUploadComplete = (file: TypeFile & {prefix?: string}) => {
    const newDirectories = directory.map(dir => {
      const {prefix, ...fileWithoutPrefix} = file;
      const convertedFile = convertData([fileWithoutPrefix])[0];
      if (dir.fullPath === prefix || (!prefix && dir.fullPath === ROOT_PATH)) {
        return {
          ...dir,
          items: dir.items ? [...dir.items, convertedFile] : [convertedFile]
        };
      }
      return dir;
    });
    setDirectory(newDirectories);
  };

  return (
    <div className={styles.container}>
      <FluidContainer
        className={styles.actionBar}
        prefix={{children: <SearchBar />}}
        suffix={{children: <ActionButtons />}}
      />
      <FluidContainer
        className={styles.storageItemContainer}
        root={{
          className: styles.storageItemColumns,
          children: (
            <StorageItemColumns
              handleFolderClick={handleFolderClick}
              setPreviewFile={setPreviewFile}
              directory={directory}
              previewFile={previewFile}
              onUploadComplete={onUploadComplete}
            />
          )
        }}
        suffix={
          previewFile && {
            className: styles.preview,
            children: (
              <FilePreview handleClosePreview={handleClosePreview} previewFile={previewFile} />
            )
          }
        }
      />
    </div>
  );
}
