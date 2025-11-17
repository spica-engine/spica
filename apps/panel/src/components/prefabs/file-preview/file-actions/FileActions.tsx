import {useCallback, useMemo, useState} from "react";
import {FlexElement, Button, Icon} from "oziko-ui-kit";
import type {DirectoryItem} from "src/types/storage";
import {DeleteFileButton} from "../../delete-file/DeleteFileButton";
import {useFileActions} from "../hooks/useFileActions";
import styles from "./FileActions.module.scss";

import {getParentPath} from "../../../../pages/storage/utils";
import {ROOT_PATH} from "../../../../pages/storage/constants";
import ImageEditor from "../../image-editor/ImageEditor";


interface FileActionsProps {
  file: DirectoryItem;
  onEdit?: () => void;
  onDelete?: (fileId: string) => void;
  isLoading?: boolean;
  onClose?: () => void;
  onFileReplaced?: (updatedFile: DirectoryItem) => void;
  updateStorageItem: (params: {id: string; file: File}) => {
    unwrap: () => Promise<any>;
  };
}

export const FileActions = ({
  file,
  onEdit,
  onFileReplaced,
  onDelete,
  isLoading,
  onClose,
  updateStorageItem
}: FileActionsProps) => {
  const isImage = file?.content?.type.startsWith("image/");

  const config = useMemo(
    () => ({
      serverUrl: import.meta.env.VITE_BASE_URL ?? "",
      origin: globalThis.window?.location.origin ?? ""
    }),
    []
  );

  const {fileInputRef, handleCopyUrl, handleReplaceFile} = useFileActions(config, {
    onFileReplaced,
    updateStorageItem
  });

  const [isImageEditorOpen, setIsImageEditorOpen] = useState(false);
  const handleOpenImageEditor = () => {
    setIsImageEditorOpen(true);
    onEdit?.();
  };
  const handleCloseImageEditor = () => {
    setIsImageEditorOpen(false);
  };

  const handleEditedImageSave = useCallback(
    async ({blob}: {blob: Blob}) => {
      if (!file?._id || !file.fullPath) {
        setIsImageEditorOpen(false);
        return;
      }

      const parentPath = getParentPath(file.fullPath);
      const extension = blob.type?.split("/")[1] ?? "png";
      const baseName = file.label || file.name || "edited-image";
      const normalizedName = baseName.endsWith(`.${extension}`) ? baseName : `${baseName}.${extension}`;
      const editedFile = new File([blob], normalizedName, {type: blob.type || "image/png"});

      const fullPath = parentPath === ROOT_PATH ? editedFile.name : `${parentPath}${editedFile.name}`;
      const encodedFileName = encodeURIComponent(fullPath);
      const uploadFile = new File([editedFile], encodedFileName, {type: editedFile.type});

      const temporaryFile: DirectoryItem = {
        ...file,
        name: fullPath,
        label: editedFile.name,
        content: {
          type: editedFile.type,
          size: editedFile.size
        }
      };

      onFileReplaced?.(temporaryFile);

      try {
        const updatedFile = await updateStorageItem({id: file._id, file: uploadFile}).unwrap();

        if (updatedFile) {
          onFileReplaced?.({
            ...updatedFile,
            label: editedFile.name,
            fullPath: updatedFile.name || editedFile.name,
            currentDepth: file.currentDepth
          });
        } else {
          onFileReplaced?.(file);
        }
      } catch (error) {
        console.error("Failed to save edited image:", error);
        onFileReplaced?.(file);
      } finally {
        setIsImageEditorOpen(false);
      }
    },
    [file, onFileReplaced, updateStorageItem]
  );

  return (
    <FlexElement gap={10}>
      <Button 
        className={styles.actionButton} 
        variant="text" 
        onClick={() => handleCopyUrl(file)}
        aria-label="Copy file URL"
      >
        <Icon name="fileMultiple" size={14} />
        Copy
      </Button>

      {isImage && (
        <Button 
          className={styles.actionButton} 
          variant="text" 
          onClick={handleOpenImageEditor}
          aria-label="Edit image"
        >
          <Icon name="pencil" size={14} />
          Edit
        </Button>
      )}
      {isImage && isImageEditorOpen && (
        <ImageEditor
          imageUrl={file.url}
          imageName={file.label || file.name}
          isOpen={isImageEditorOpen}
          onClose={handleCloseImageEditor}
          onSave={handleEditedImageSave}
        />
      )}

      <Button
        className={styles.actionButton}
        variant="text"
        onClick={() => fileInputRef.current?.click()}
        disabled={isLoading}
        aria-label="Replace file"
      >
        <Icon name="swapHorizontal" size={14} />
        Replace
      </Button>

      <input
        type="file"
        style={{display: "none"}}
        onChange={e => handleReplaceFile(e, file)}
        ref={fileInputRef}
      />

      <DeleteFileButton fileId={file._id} onFileDeleted={onDelete} onClose={onClose} />
    </FlexElement>
  );
};
