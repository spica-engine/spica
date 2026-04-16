import React, {useState, useCallback, useMemo} from "react";
import {StorageInput} from "oziko-ui-kit";
import type {TypeChangeEvent} from "oziko-ui-kit/dist/custom-hooks/useInputRepresenter";
import StorageFileSelect from "../../organisms/storage-file-select/StorageFileSelect";
import {useUploadFilesMutation, useGetStorageItemQuery} from "../../../store/api/storageApi";
import type {Storage} from "../../../store/api/storageApi";
import useStorage from "../../../hooks/useStorage";

interface StorageFieldInputProps {
  fieldKey: string;
  title: string;
  description: string;
  value?: string;
  className?: string;
  onChange?: (event: TypeChangeEvent<string>) => void;
}

const StorageFieldInput: React.FC<StorageFieldInputProps> = ({
  title,
  value,
  className,
  onChange,
  ...rest
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploadFiles] = useUploadFilesMutation();
  const {convertStorageToTypeFile} = useStorage();

  const storageId = useMemo(() => {
    if (!value) return null;
    if (typeof value === "string") return value;
    return null;
  }, [value]);

  const {data: fetchedStorage} = useGetStorageItemQuery(storageId || "", {
    skip: !storageId,
  });

  const typeFile = useMemo(() => {
    if (fetchedStorage) return convertStorageToTypeFile(fetchedStorage);
    return undefined;
  }, [fetchedStorage, convertStorageToTypeFile]);

  const handleClickShowFileSelect = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const handleFileSelect = useCallback(
    (file: Storage) => {
      onChange?.({key: rest.fieldKey, value: file._id || ""});
      handleCloseModal();
    },
    [onChange, rest.fieldKey, handleCloseModal]
  );

  const handleUpload = useCallback(
    async (file: File) => {
      try {
        const fileList = new DataTransfer();
        fileList.items.add(file);
        const result = await uploadFiles({files: fileList.files}).unwrap();
        if (result && result.length > 0) {
          onChange?.({key: rest.fieldKey, value: result[0]._id || ""});
        }
      } catch (error) {
        console.error("Failed to upload file:", error);
      }
    },
    [uploadFiles, onChange, rest.fieldKey]
  );

  const handleDelete = useCallback(() => {
    onChange?.({key: rest.fieldKey, value: ""});
  }, [onChange, rest.fieldKey]);

  return (
    <>
      <StorageInput
        file={typeFile}
        label={title}
        onUpload={handleUpload}
        onClickShowFileSelect={handleClickShowFileSelect}
        onDelete={handleDelete}
        containerProps={{className}}
      />
      <StorageFileSelect
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onFileSelect={handleFileSelect}
      />
    </>
  );
};

export default StorageFieldInput;
