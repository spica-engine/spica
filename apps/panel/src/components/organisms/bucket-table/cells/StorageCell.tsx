import React, { useState, useCallback, useMemo } from "react";
import type { CellRendererProps } from "../types";
import StorageFileSelect from "../../storage-file-select/StorageFileSelect";
import { useUploadFilesMutation, useGetStorageItemQuery } from "../../../../store/api/storageApi";
import type { Storage } from "../../../../store/api/storageApi";
import { StorageMinimizedInput } from "oziko-ui-kit";
import useStorage from "../../../../hooks/useStorage";
import styles from "./Cells.module.scss";

export const StorageCell: React.FC<CellRendererProps> = ({
  value,
  onChange,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploadFiles] = useUploadFilesMutation();
  const { convertStorageToTypeFile } = useStorage();

  const storageId = useMemo(() => {
    if (!value) return null;
    if (typeof value === "string") return value;
    if (typeof value === "object" && value._id) return value._id;
    return null;
  }, [value]);

  const { data: fetchedStorage } = useGetStorageItemQuery(storageId || "", {
    skip: !storageId || typeof value === "object",
  });

  const storageValue = useMemo(() => {
    if (!value) return null;
    if (typeof value === "object" && value._id) return value as Storage;
    if (typeof value === "string" && fetchedStorage) return fetchedStorage;
    return null;
  }, [value, fetchedStorage]);

  const typeFile = storageValue ? convertStorageToTypeFile(storageValue) : undefined;

  const handleClickShowFileSelect = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const handleFileSelect = useCallback(
    (file: Storage) => {
      onChange(file._id || null);
      handleCloseModal();
    },
    [onChange, handleCloseModal]
  );

  const handleUpload = useCallback(
    async (file: File) => {
      try {
        const fileList = new DataTransfer();
        fileList.items.add(file);
        const result = await uploadFiles({ files: fileList.files }).unwrap();
        if (result && result.length > 0) {
          onChange(result[0]._id || null);
        }
      } catch (error) {
        console.error("Failed to upload file:", error);
      }
    },
    [uploadFiles, onChange]
  );

  const handleDelete = useCallback(() => {
    onChange(null);
  }, [onChange]);

  return (
    <>
      <StorageMinimizedInput
        file={typeFile}
        placeholder="Click or Drag&Drop"
        onUpload={handleUpload}
        onClickShowFileSelect={handleClickShowFileSelect}
        onDelete={handleDelete}
        dimensionX="fill"
        className={styles.storageCell}
      />
      <StorageFileSelect
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onFileSelect={handleFileSelect}
      />
    </>
  );
};

