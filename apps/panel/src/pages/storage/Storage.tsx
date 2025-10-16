import {
  FlexElement,
  FluidContainer,
  Icon,
  type TypeAlignment,
  Text,
  type TypeFile,
  Button,
  type TypeFluidContainer
} from "oziko-ui-kit";
import styles from "./Storage.module.scss";
import {useGetStorageItemsQuery} from "../../store/api";
import {memo, useEffect, useMemo, useState} from "react";
import useStorage from "../../hooks/useStorage";
import useFileView from "../../hooks/useFileView";
import SearchBar from "../../components/atoms/search-bar/SearchBar";
import CreateFolder from "../../components/molecules/create-folder-modal/CreateFolderModal";
import CreateFile from "../../components/molecules/create-file-modal/CreateFile";

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

const FilePreview = memo(({handleClosePreview, previewFile}: FilePreviewProps) => {
  const fileView = useFileView({file: previewFile});

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
              <Text className={styles.metadataName}>{previewFile?.name}</Text>
              <Text>{previewFile?.content?.type}</Text>
              {/* The previewFile does not have a date value but the figma has a date in here */}
              {(previewFile as any)?.createdAt && (
                <Text>{new Date((previewFile as any).createdAt).toLocaleString()}</Text>
              )}
            </FlexElement>
            <FlexElement gap={10}>
              <Button className={styles.metadataButton} variant="icon">
                <Icon name="folder" size={14} />
                Copy
              </Button>
              <Button className={styles.metadataButton} variant="icon">
                <Icon name="pencil" size={14} />
                Edit
              </Button>
              <Button className={styles.metadataButton} variant="icon">
                <Icon name="close" size={14} />
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
  files?: TypeFile[];
  handleFolderClick: (
    folderName: string,
    fullPath: string,
    depth: TypeDirectoryDepth,
    isActive: boolean
  ) => void;
  setPreviewFile: (file: TypeFile) => void;
  depth: TypeDirectoryDepth;
  directory: TypeDirectories;
  previewFileFullPath?: string;
}

const StorageItemColumn = memo(
  ({
    files,
    handleFolderClick,
    setPreviewFile,
    depth,
    directory,
    previewFileFullPath
  }: StorageItemColumnProps) => {
    return (
      <FlexElement
        className={styles.storageItemColumn}
        direction="vertical"
        alignment={"left" as TypeAlignment}
        gap={10}
      >
        {files?.map((item, index) => {
          const isFolder = item?.content?.type === "inode/directory";
          const fullPath = item.name;
          const isActive = isFolder
            ? directory.find(i => i.fullPath === fullPath)?.isActive || false
            : previewFileFullPath === fullPath;

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
  onFileClick: (file: TypeFile) => void;
  isActive: boolean;
}

const StorageItem = memo(({item, onFolderClick, onFileClick, isActive}: StorageItemProps) => {
  const folderName = (item as TypeDirectory).label || (item as TypeFile).name;
  const isFolder = item?.content?.type === "inode/directory";
  const handleFolderClick = () => onFolderClick?.(folderName);
  const handleFileClick = () => onFileClick(item as TypeFile);
  return (
    <FlexElement
      onClick={isFolder ? handleFolderClick : handleFileClick}
      className={`${styles.storageItem} ${isFolder ? styles.folder : styles.file} ${isActive ? styles.activeStorageItem : ""}`}
    >
      <Icon name={isFolder ? "folder" : "fileDocument"} size={14} />
      <Text className={styles.storageItemText} size="medium">
        {folderName}
      </Text>
    </FlexElement>
  );
});

interface ActionButtonsProps {
  directory: TypeDirectories;
}

const ActionButtons = memo(({directory}: ActionButtonsProps) => {
  const visibleDirectories = directory.filter(dir => dir.currentDepth);
  const currentPrefix = visibleDirectories
    .filter(i => i.fullPath !== ROOT_PATH)
    .map(i => i.label)
    .join("");
  const currentItemNames = visibleDirectories
    .map(dir => dir.items?.map(item => item.name).filter(Boolean) || [])
    .flat();

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
      <CreateFile prefix={currentPrefix}>
        {({onOpen}) => (
          <Button className={styles.actionBarButton} variant="filled" onClick={onOpen}>
            <Icon name="plus" />
            Upload Files
          </Button>
        )}
      </CreateFile>
      <CreateFolder prefix={currentPrefix} currentItemNames={currentItemNames}>
        {({onOpen}) => (
          <Button className={styles.actionBarButton} variant="filled" onClick={onOpen}>
            <Icon name="plus" />
            Create New Folder
          </Button>
        )}
      </CreateFolder>
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
  setPreviewFile: (file: TypeFile) => void;
  directory: TypeDirectories;
  previewFile?: TypeFile;
}

const StorageItemColumns = memo(
  ({handleFolderClick, setPreviewFile, directory, previewFile}: StorageItemColumnsProps) => {
    const columns = [1, 2, 3] as TypeDirectoryDepth[];
    return (
      <FluidContainer
        dimensionY="fill"
        dimensionX="fill"
        {...columns.reduce((acc, depth) => {
          const files = directory.find(dir => dir.currentDepth === depth)?.items;
          if (!files) return acc;
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

          acc[key as keyof TypeFluidContainer] = {
            className: styles.storageItemColumnContainer,
            children: (
              <StorageItemColumn
                files={files}
                handleFolderClick={handleFolderClick}
                setPreviewFile={setPreviewFile}
                depth={depth}
                directory={directory}
                previewFileFullPath={previewFile?.name}
              />
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

  useEffect(() => {
    const data = storageData?.data ?? (storageData as unknown as TypeFile[]);
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

  return (
    <div className={styles.container}>
      <FluidContainer
        className={styles.actionBar}
        prefix={{children: <SearchBar />}}
        suffix={{
          children: <ActionButtons directory={directory} />
        }}
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
