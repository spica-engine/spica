import {type FC, memo, useEffect, useState} from "react";
import styles from "./StorageFileSelect.module.scss";
import {Modal, StorageFileCard, type TypeFile} from "oziko-ui-kit";
import {type TypeSortProp} from "./sort-popover-content/SortPopoverContent";
import StorageModalHeading from "./storage-modal-heading/StorageModalHeading";


type TypeStorageFileSelect = {
  className?: string;
  isOpen?: boolean;
};

const StorageFileSelect: FC<TypeStorageFileSelect> = ({
  isOpen = false
}) => {
  const [directory, setDirectory] = useState(["/"]);
  const [fileLength, setFileLength] = useState(0);
  const [folderLength, setFolderLength] = useState(0);
  
  // TODO: These will be implemented via context
  const data: TypeFile[] = [];
  
  const handleClickSortProp = (prop: TypeSortProp) => {
    // TODO: Will be implemented via context
  };

  const handleClickFile = (file: TypeFile) => {
    // TODO: Will be implemented via context
  };
  
  const handleChangeSearch = (search: string) => {
    // TODO: Will be implemented via context
  };

  const handleChangeDirectory = (index: number) => {
    setDirectory(directory.slice(0, index + 1));
  };

  useEffect(() => {
    // TODO Should calculate file and folder length
  }, [data]);

  return (
    <Modal isOpen={isOpen} showCloseButton={false} className={styles.container} dimensionX="fill">
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
      <Modal.Body gap={12} className={styles.content}>
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
      </Modal.Body>
    </Modal>
  );
};

export default memo(StorageFileSelect);
