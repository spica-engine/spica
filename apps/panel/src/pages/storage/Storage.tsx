import {
  FlexElement,
  FluidContainer,
  Icon,
  type TypeAlignment,
  Text,
  type TypeFile,
  Button
} from "oziko-ui-kit";
import styles from "./Storage.module.scss";
import {useGetStorageItemsQuery} from "../../store/api";
import {memo, useEffect, useMemo, useRef, useState} from "react";
import useStorage from "../../hooks/useStorage";
import useFileView from "../../hooks/useFileView";
import SearchBar from "../../components/atoms/search-bar/SearchBar";
import CreateFolder from "../../components/molecules/create-folder-modal/CreateFolderModal";
import CreateFile from "../../components/molecules/create-file-modal/CreateFile";

type TypeDirectories = [string, string?, string?];
type TypeFiles = [TypeFile[]?, TypeFile[]?, TypeFile[]?];
type TypeDirectoryDepth = 0 | 1 | 2

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
              {/* The previewFile does not have no date value but the figma has a date in here */}
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
  handleFolderClick: (folderName: string, depth: TypeDirectoryDepth) => void;
  setPreviewFile: (file: TypeFile) => void;
  depth: TypeDirectoryDepth;
}

const StorageItemColumn = memo(
  ({files, handleFolderClick, setPreviewFile, depth}: StorageItemColumnProps) => {
    return (
      <FlexElement
        className={styles.storageItemColumn}
        direction="vertical"
        alignment={"left" as TypeAlignment}
        gap={10}
      >
        {files?.map((item, index) => (
          <StorageItem
            key={index}
            item={item}
            onFolderClick={folderName => handleFolderClick(folderName, depth)}
            onFileClick={setPreviewFile}
          />
        ))}
      </FlexElement>
    );
  }
);

interface StorageItemProps {
  item: TypeFile;
  onFolderClick?: (folderName: string) => void;
  onFileClick: (file: TypeFile) => void;
}

const StorageItem = memo(({item, onFolderClick, onFileClick}: StorageItemProps) => {
  const isFolder = item?.content?.type === "inode/directory";
  const handleFolderClick = () => onFolderClick?.(item.name);
  const handleFileClick = () => onFileClick(item);
  return (
    <FlexElement
      onClick={isFolder ? handleFolderClick : handleFileClick}
      className={`${styles.storageItem} ${isFolder ? styles.folder : styles.file}`}
    >
      <Icon name={isFolder ? "folder" : "fileDocument"} size={14} />
      <Text className={styles.storageItemText} size="medium">
        {item.name}
      </Text>
    </FlexElement>
  );
});

interface ActionButtonsProps {
  directory: TypeDirectories;
  files: TypeFiles;
}

const ActionButtons = memo(({directory, files}: ActionButtonsProps) => {
  const currentPrefix = directory.slice(1).join("");
  const currentItemNames = files
    .map((filesArray, index) =>
      filesArray?.map(f => {
        return `${index === 0 ? "" : directory[index]}${f.name}`;
      })
    )
    .flat()
    .filter(Boolean) as string[];

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
  files: TypeFiles;
  handleFolderClick: (folderName: string, depth: TypeDirectoryDepth) => void;
  setPreviewFile: (file: TypeFile) => void;
  directory: TypeDirectories;
}

const StorageItemColumns = memo(
  ({files, handleFolderClick, setPreviewFile, directory}: StorageItemColumnsProps) => {
    const renderSecondRow = directory[1] !== undefined;
    const renderThirdRow = directory[2] !== undefined;

    return (
      <FluidContainer
        dimensionY="fill"
        dimensionX="fill"
        prefix={{
          className: styles.storageItemColumnContainer,
          children: (
            <StorageItemColumn
              files={files[0]}
              handleFolderClick={handleFolderClick}
              setPreviewFile={setPreviewFile}
              depth={0}
            />
          )
        }}
        root={{
          className: `${styles.storageItemColumnContainer} ${renderSecondRow ? "" : styles.hidden}`,
          children: (
            <StorageItemColumn
              files={files[1]}
              handleFolderClick={handleFolderClick}
              setPreviewFile={setPreviewFile}
              depth={1}
            />
          )
        }}
        suffix={{
          className: `${styles.storageItemColumnContainer} ${renderThirdRow ? "" : styles.hidden}`,
          children: (
            <StorageItemColumn
              files={files[2]}
              handleFolderClick={handleFolderClick}
              setPreviewFile={setPreviewFile}
              depth={2}
            />
          )
        }}
      />
    );
  }
);

export default function StoragePage() {
  const [directory, setDirectory] = useState<TypeDirectories>(["/"]);
  const targetColumnIndex = useRef(0);
  const {buildDirectoryFilter, convertStorageToTypeFile} = useStorage();
  const filter = useMemo(() => buildDirectoryFilter(directory as string[]), [directory]);
  const {data: storageData} = useGetStorageItemsQuery({filter});

  const [files, setFiles] = useState<TypeFiles>([]);
  const [previewFile, setPreviewFile] = useState<TypeFile>();

  const handleFolderClick = (folderName: string, directoryDepth: TypeDirectoryDepth) => {
    let newDirectories: TypeDirectories = [...directory];
    if (directoryDepth === 0) {
      newDirectories[2] = undefined;
    } else if (directoryDepth === 2) {
      newDirectories = newDirectories.slice(-3) as TypeDirectories;
      const newFiles = [files[1], files[2]];
      setFiles(newFiles as TypeFiles);
    }
    newDirectories[directoryDepth + 1] = folderName;
    targetColumnIndex.current = directoryDepth + 1;
    setDirectory(newDirectories);
  };

  useEffect(() => {
    const convertedData = (storageData?.data ?? (storageData as unknown as TypeFile[]))?.map(
      convertStorageToTypeFile
    );

    if (!convertedData) return;

    const transformedData = convertedData.map(i => {
      const isFolder = i.content?.type === "inode/directory";
      const isInRoot = targetColumnIndex.current === 0;
      const nameParts = i.name.split("/").filter(Boolean);
      const resolvedName = nameParts[nameParts.length - 1] + (isFolder ? "/" : "");
      if (isFolder || !isInRoot) return {...i, name: resolvedName};
      return i;
    });

    const newFiles: TypeFiles = [...files];
    newFiles[targetColumnIndex.current] = transformedData;

    for (let i = targetColumnIndex.current + 1; i < 3; i++) {
      newFiles[i] = undefined;
    }

    setFiles(newFiles);
  }, [storageData]);

  const handleClosePreview = () => setPreviewFile(undefined);

  return (
    <div className={styles.container}>
      <FluidContainer
        className={styles.actionBar}
        prefix={{children: <SearchBar />}}
        suffix={{
          children: <ActionButtons directory={directory} files={files} />
        }}
      />
      <FluidContainer
        className={styles.storageItemContainer}
        root={{
          className: styles.storageItemColumns,
          children: (
            <StorageItemColumns
              files={files}
              handleFolderClick={handleFolderClick}
              setPreviewFile={setPreviewFile}
              directory={directory}
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
