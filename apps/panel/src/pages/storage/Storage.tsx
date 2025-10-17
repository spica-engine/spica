import {FlexElement, FluidContainer, Icon, type TypeFile, Button} from "oziko-ui-kit";
import styles from "./Storage.module.scss";
import {useGetStorageItemsQuery} from "../../store/api";
import {memo, useEffect, useMemo, useState} from "react";
import useStorage from "../../hooks/useStorage";
import SearchBar from "../../components/atoms/search-bar/SearchBar";
import {
  type TypeDirectoryDepth,
  type DirectoryItem,
  type TypeDirectories,
  StorageItemColumns
} from "../../components/organisms/storage-columns/StorageColumns";
import {FilePreview} from "../../components/molecules/file-preview/FilePreview";

const ROOT_PATH = "/";
const getParentPath = (fullPath?: string) => {
  const res =
    fullPath?.replace(/\/[^/]+\/?$/, "") === fullPath
      ? "/"
      : fullPath?.replace(/\/[^/]+\/?$/, "") || "/";
  return res === "/" ? res : res + "/";
};

function findMaxDepthDirectory<T extends {currentDepth?: number}>(arr: T[]): T | undefined {
  return arr.reduce<T | undefined>((max, obj) => {
    if (obj.currentDepth === undefined) return max;
    if (!max || max.currentDepth === undefined || obj.currentDepth > max.currentDepth) return obj;
    return max;
  }, undefined);
}

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
  const [previewFile, setPreviewFile] = useState<DirectoryItem>();

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
      if (!dirToChange) return;
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
        const newDepth = ((theDirectory.currentDepth as TypeDirectoryDepth) -
          1) as TypeDirectoryDepth;
        return {...dir, isActive: newDepth > 0, currentDepth: newDepth > 0 ? newDepth : undefined};
      } else if (getParentPath(getParentPath(theDirectory.fullPath)) === dir.fullPath) {
        const newDepth = ((theDirectory.currentDepth as TypeDirectoryDepth) -
          2) as TypeDirectoryDepth;
        return {...dir, isActive: newDepth > 0, currentDepth: newDepth > 0 ? newDepth : undefined};
      } else if (dir.fullPath === theDirectory.fullPath) {
        return theDirectory;
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

  const onFileReplaced = (updatedFile: TypeFile) => {
    const newDirectories = directory.map(dir => {
      if (dir.items) {
        const updatedItems = dir.items.map(item =>
          item._id === updatedFile._id ? updatedFile : item
        );
        return {
          ...dir,
          items: updatedItems
        };
      }
      return dir;
    });
    setDirectory(newDirectories as TypeDirectories);
    setPreviewFile(updatedFile as DirectoryItem);
  };

  const onFileDeleted = (fileId: string) => {
    const newDirectories = directory.map(dir => {
      if (dir.items) {
        const filteredItems = dir.items.filter(item => item._id !== fileId);
        return {
          ...dir,
          items: filteredItems
        };
      }
      return dir;
    });
    setDirectory(newDirectories as TypeDirectories);
    setPreviewFile(undefined);
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
              <FilePreview
                handleClosePreview={handleClosePreview}
                previewFile={previewFile}
                onFileReplaced={onFileReplaced}
                onFileDeleted={onFileDeleted}
              />
            )
          }
        }
      />
    </div>
  );
}
