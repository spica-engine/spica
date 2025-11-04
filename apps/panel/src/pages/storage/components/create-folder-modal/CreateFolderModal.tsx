import React, {useState, type FC, type ReactNode} from "react";
import {Button, FluidContainer, Icon, Text, FlexElement, Modal, StringInput} from "oziko-ui-kit";
import styles from "./CreateFolderModal.module.scss";
import {useUploadFilesMutation} from "../../../../store/api/storageApi";

type CreateFolderProps = {
  initialValue?: string;
  prefix?: string;
  buttonClassName?: string;
  forbiddenNames?: string[];
};

type FolderNameValidationResult = {
  isValid: boolean;
  error: string | null;
};

const FOLDER_NAME_PATTERN = /^[^\/\ \.]+/;

const CreateFolder: FC<CreateFolderProps> = ({
  initialValue = "",
  prefix = "",
  buttonClassName,
  forbiddenNames
}) => {
  const [createFolder] = useUploadFilesMutation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [value, setValue] = useState(initialValue);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  function validateFolderNameStructure(value: string): FolderNameValidationResult {
    if (!value.trim()) return {isValid: false, error: "This field cannot be left empty."};
    if (value.length > 100)
      return {isValid: false, error: "This field cannot exceed 100 characters"};
    if (!FOLDER_NAME_PATTERN.test(value.trim()))
      return {
        isValid: false,
        error: "Folder name cannot start with a dot, space, or contain forward slashes."
      };
    return {isValid: true, error: null};
  }

  function isFolderNameForbidden(folderName: string): {forbidden: boolean; folderName: string | null; error: string | null} {
    const fullFolderName = prefix + (folderName.endsWith("/") ? folderName : folderName + "/");
    return forbiddenNames?.some(name => name === fullFolderName)
      ? {forbidden: true, folderName: fullFolderName, error: "A file or folder with this name already exists."}
      : {forbidden: false, folderName: null, error: null};
  }

  const handleSave = async () => {
    try {
      setLoading(true);

      const validation = validateFolderNameStructure(value);
      if (!validation.isValid) {
        setError(validation.error ?? "");
        return;
      }

      const rawFolderName = value.trim();
      const folderName =
        prefix + (rawFolderName.endsWith("/") ? rawFolderName : rawFolderName + "/");

      if (forbiddenNames?.some(name => name === folderName)) {
        setError("A file or folder with this name already exists.");
        return;
      }

      const encodedFolderName = encodeURIComponent(folderName ?? "");
      const emptyFolder = new File([], encodedFolderName);
      await createFolder({files: [emptyFolder] as unknown as FileList});
      setIsModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setValue(initialValue);
    setError("");
  };

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setValue(initialValue);
    setIsModalOpen(true);
  };

  const handleChange = (value: string) => {
    setValue(value);
    if (error && value.trim() && FOLDER_NAME_PATTERN.test(value.trim())) {
      setError("");
    }
  };

  return (
    <>
      <Button className={buttonClassName} variant="filled" onClick={handleOpen}>
        <Icon name="plus" />
        Create New Folder
      </Button>
      {isModalOpen && (
        <Modal showCloseButton={false} onClose={handleClose} className={styles.modal} isOpen>
          <FluidContainer
            className={`${styles.container} ${error ? styles.containerWithError : ""}`}
            direction="vertical"
            gap={10}
            mode="fill"
            prefix={{
              children: (
                <div className={styles.header}>
                  <Text className={styles.headerText}>CREATE NEW FOLDER</Text>
                </div>
              )
            }}
            root={{
              children: (
                <div className={styles.content}>
                  <StringInput
                    className={styles.input}
                    onChange={handleChange}
                    value={value}
                    label="Folder Name"
                  />
                  {error && (
                    <Text variant="danger" className={styles.errorText}>
                      {error}
                    </Text>
                  )}
                </div>
              )
            }}
            suffix={{
              dimensionX: "fill",
              alignment: "rightCenter",
              children: (
                <FlexElement gap={10} className={styles.buttonsContainer}>
                  <div className={styles.addButtonWrapper}>
                    <Button
                      className={styles.addButton}
                      onClick={handleSave}
                      disabled={loading}
                      loading={loading}
                    >
                      <Icon name="save" />
                      <Text className={styles.addButtonText}>Save</Text>
                    </Button>
                  </div>
                  <Button
                    className={styles.cancelButton}
                    variant="text"
                    onClick={handleClose}
                    disabled={loading}
                  >
                    <Icon name="close" />
                    <Text>Cancel</Text>
                  </Button>
                </FlexElement>
              )
            }}
          />
        </Modal>
      )}
    </>
  );
};

export default CreateFolder;
