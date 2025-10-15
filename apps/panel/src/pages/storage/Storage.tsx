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
import {useEffect, useState} from "react";
import useStorage from "../../hooks/useStorage";
import useFileView from "../../hooks/useFileView";
import SearchBar from "../../components/atoms/search-bar/SearchBar";
import CreateFolder from "../../components/molecules/create-folder-modal/CreateFolderModal";
import CreateFile from "../../components/molecules/create-file-modal/CreateFile";

type TypeDirectories = [string, string?, string?];
type TypeFiles = [TypeFile[]?, TypeFile[]?, TypeFile[]?];

const StorageItem = ({
  item,
  onFolderClick,
  onFileClick
}: {
  item: TypeFile;
  onFolderClick?: (folderName: string) => void;
  onFileClick: (file: TypeFile) => void;
}) => {
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
};

export default function StoragePage() {
  const [directory, setDirectory] = useState<TypeDirectories>(["/"]);
  const {buildDirectoryFilter, convertStorageToTypeFile} = useStorage();

  const filter = buildDirectoryFilter(directory as string[]);

  const {data: storageData, isLoading} = useGetStorageItemsQuery({filter});

  const [files, setFiles] = useState<TypeFiles>([]);
  const [previewFile, setPreviewFile] = useState<TypeFile>();

  const handleFolderClick = (folderName: string, directoryDepth: number) => {
    const newDirectories: TypeDirectories = [...directory];
    newDirectories[directoryDepth + 1] = folderName;
    if (directoryDepth + 2 < 3) {
      newDirectories[directoryDepth + 2] = undefined;
    }
    setDirectory(newDirectories);
    setPreviewFile(undefined);
  };

  const targetColumnIndex = directory[2] !== undefined ? 2 : directory[1] !== undefined ? 1 : 0;

  useEffect(() => {
    const convertedData = (storageData?.data ?? (storageData as unknown as TypeFile[]))?.map(
      convertStorageToTypeFile
    );

    if (!convertedData) return;

    const transformedData = convertedData.map(i => {
      const isFolder = i.content?.type === "inode/directory";
      const isInRoot = directory.length === 1;
      const nameParts = i.name.split("/").filter(Boolean);
      const resolvedName = nameParts[nameParts.length - 1] + (isFolder ? "/" : "");
      if (isFolder || !isInRoot) return {...i, name: resolvedName};
      return i;
    });

    if (JSON.stringify(files[targetColumnIndex - 1]) === JSON.stringify(transformedData)) return;
    const newFiles: TypeFiles = [...files];
    newFiles[targetColumnIndex] = transformedData;

    for (let i = targetColumnIndex + 1; i < 3; i++) {
      newFiles[i] = undefined;
    }

    setFiles(newFiles);
  }, [storageData, directory, convertStorageToTypeFile]);

  const renderSecondRow = directory[1] !== undefined;
  const renderThirdRow = directory[2] !== undefined;

  const fileView = useFileView({file: previewFile});

  const handleClosePreview = () => setPreviewFile(undefined);

  const currentPrefix = directory.slice(1).join("");

  const currentItemNames = files
    .map((filesArray, index) =>
      filesArray?.map(f => {
        return `${index === 0 ? "" : directory[index]}${f.name}`;
      })
    )
    .flat();

  return (
    <div className={styles.container}>
      <FluidContainer
        className={styles.actionBar}
        prefix={{children: <SearchBar />}}
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
          )
        }}
      />
      <FluidContainer
        className={styles.storageItemContainer}
        root={{
          className: styles.storageItemColumns,
          children: (
            <FluidContainer
              dimensionY="fill"
              dimensionX="fill"
              prefix={{
                className: styles.storageItemColumnContainer,
                children: (
                  <FlexElement
                    className={styles.storageItemColumn}
                    direction="vertical"
                    alignment={"left" as TypeAlignment}
                    gap={10}
                  >
                    {files[0]?.map((item, index) => (
                      <StorageItem
                        key={index}
                        item={item}
                        onFolderClick={folderName => handleFolderClick(folderName, 0)}
                        onFileClick={setPreviewFile}
                      />
                    ))}
                  </FlexElement>
                )
              }}
              root={
                renderSecondRow
                  ? {
                      className: styles.storageItemColumnContainer,
                      children: (
                        <FlexElement
                          className={styles.storageItemColumn}
                          direction="vertical"
                          alignment={"left" as TypeAlignment}
                          gap={10}
                        >
                          {!isLoading &&
                            files[1]?.map((item, index) => (
                              <StorageItem
                                key={index}
                                item={item}
                                onFolderClick={folderName => handleFolderClick(folderName, 1)}
                                onFileClick={setPreviewFile}
                              />
                            ))}
                        </FlexElement>
                      )
                    }
                  : undefined
              }
              suffix={
                renderThirdRow
                  ? {
                      className: styles.storageItemColumnContainer,
                      children: (
                        <FlexElement
                          className={styles.storageItemColumn}
                          direction="vertical"
                          alignment={"left" as TypeAlignment}
                          gap={10}
                        >
                          {!isLoading &&
                            files[2]?.map((item, index) => (
                              <StorageItem key={index} item={item} onFileClick={setPreviewFile} />
                            ))}
                        </FlexElement>
                      )
                    }
                  : undefined
              }
            />
          )
        }}
        suffix={
          previewFile && {
            className: styles.preview,
            children: (
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
            )
          }
        }
      />
    </div>
  );
}
