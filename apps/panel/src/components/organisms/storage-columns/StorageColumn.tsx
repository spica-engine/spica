import {
  FlexElement,
  FluidContainer,
  Icon,
  type TypeAlignment,
  Text,
  type TypeFluidContainer,
  Spinner,
  type TypeFile,
} from "oziko-ui-kit";
import styles from "./StorageColumns.module.scss";
import {useUploadFilesMutation} from "../../../store/api/storageApi";
import {memo, useMemo, type DragEventHandler} from "react";

export type TypeDirectoryDepth = 1 | 2 | 3;
export type DirectoryItem = TypeFile & {fullPath: string, label?: string};
export type TypeDirectory = {
  items?: DirectoryItem[];
  label: string;
  fullPath: string;
  currentDepth?: TypeDirectoryDepth;
  isActive: boolean;
  content: {
    type: string;
    size: number;
  };
};
export type TypeDirectories = TypeDirectory[];

interface StorageItemProps {
  item: DirectoryItem | TypeDirectory;
  onFolderClick?: (folderName: string) => void;
  onFileClick: (file?: DirectoryItem) => void;
  isActive: boolean;
}

const StorageItem = memo(({item, onFolderClick, onFileClick, isActive}: StorageItemProps) => {
  const itemName = (item as TypeDirectory).label || (item as DirectoryItem).name;
  const isFolder = item?.content?.type === "inode/directory";
  const handleFolderClick = () => onFolderClick?.(itemName);
  const handleFileClick = () => onFileClick(isActive ? undefined : (item as DirectoryItem));
  return (
    <FlexElement
      onClick={isFolder ? handleFolderClick : handleFileClick}
      className={`${styles.storageItem} ${isActive ? styles.activeStorageItem : ""}`}
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


interface StorageItemColumnProps {
  items?: DirectoryItem[];
  handleFolderClick: (
    folderName: string,
    fullPath: string,
    depth: TypeDirectoryDepth,
    isActive: boolean
  ) => void;
  setPreviewFile: (file?: DirectoryItem) => void;
  depth: TypeDirectoryDepth;
  directory: TypeDirectories;
  previewFileId?: string;
  prefix: string;
  onUploadComplete?: (file: TypeFile & {prefix?: string}) => void;
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
          const uploadedFile = response?.data?.[0] as DirectoryItem | undefined;
          if (uploadedFile) {
            onUploadComplete?.({...uploadedFile, prefix});
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
              key={item._id}
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

export interface StorageItemColumnsProps {
  handleFolderClick: (
    folderName: string,
    fullPath: string,
    directoryDepth: TypeDirectoryDepth,
    wasActive: boolean
  ) => void;
  setPreviewFile: (file: DirectoryItem | undefined) => void;
  directory: TypeDirectories;
  previewFile?: DirectoryItem;
  onUploadComplete?: (file: TypeFile & {prefix?: string}) => void;
  isDraggingDisabled?: boolean;
}

export const StorageItemColumns: React.FC<StorageItemColumnsProps> = ({
  handleFolderClick,
  setPreviewFile,
  directory,
  previewFile,
  onUploadComplete,
  isDraggingDisabled = false
}) => {
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
};