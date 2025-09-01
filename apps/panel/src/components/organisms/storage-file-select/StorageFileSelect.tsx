import {type FC, memo, useEffect, useState} from "react";
import styles from "./StorageFileSelect.module.scss";
import {Modal, StorageFileCard} from "oziko-ui-kit";
import {type TypeSortProp} from "./sort-popover-content/SortPopoverContent";
import StorageModalHeading from "./storage-modal-heading/StorageModalHeading";
import {type TypeFile} from "../../../../../../node_modules/oziko-ui-kit/build/dist/utils/interface";

type TypeStorageFileSelect = {
  data: TypeFile[];
  className?: string;
  onChangeSearch?: (search: string) => void;
  onClickSort?: (prop: TypeSortProp) => void;
  onChooseFile?: (file: TypeFile) => void;
  isOpen?: boolean;
};

const StorageFileSelect: FC<TypeStorageFileSelect> = ({
  data,
  onChangeSearch,
  onClickSort,
  onChooseFile,
  isOpen = false
}) => {
  const [directory, setDirectory] = useState(["/"]);
  const [fileLength, setFileLength] = useState(0);
  const [folderLength, setFolderLength] = useState(0);

  const handleClickSortProp = (prop: TypeSortProp) => {
    onClickSort?.(prop);
  };

  const handleClickFile = (file: TypeFile) => {
    onChooseFile?.(file);
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
              onChangeSearch={onChangeSearch}
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
