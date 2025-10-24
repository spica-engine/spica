import {memo, useState} from "react";
import {Button, Icon} from "oziko-ui-kit";
import {useDeleteStorageItemMutation} from "../../../../store/api";
import Confirmation from "../../confirmation/Confirmation";
import styles from "./FilePreview.module.scss";

interface DeleteFileButtonProps {
  fileId: string;
  onFileDeleted: (fileId: string) => void;
  onClose: () => void;
}

export const DeleteFileButton = memo(({fileId, onFileDeleted, onClose}: DeleteFileButtonProps) => {
  const [deleteStorageItem, {isLoading, error}] = useDeleteStorageItemMutation();
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  const handleDeleteConfirm = async () => {
    try {
      await deleteStorageItem(fileId).unwrap();
      onFileDeleted(fileId);
      setShowDeleteConfirmation(false);
      onClose();
    } catch (error) {
      console.error("File deletion failed:", error);
    } finally {
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirmation(false);
  };

  return (
    <>
      <Button
        className={`${styles.actionButton} ${styles.clearButton}`}
        color="danger"
        onClick={() => setShowDeleteConfirmation(true)}
      >
        <Icon name="delete" size={14} />
        Delete
      </Button>
      {showDeleteConfirmation && (
        <Confirmation
          title="DELETE FILE"
          inputPlaceholder="Type Here"
          description={
            <>
              <span>This action will permanently delete the file.</span>
              <span>
                Please type <strong>agree</strong> to confirm deletion.
              </span>
            </>
          }
          confirmLabel={
            <>
              <Icon name="delete" />
              Delete
            </>
          }
          cancelLabel={
            <>
              <Icon name="close" />
              Cancel
            </>
          }
          confirmCondition={input => input === "agree"}
          showInput={true}
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
          loading={isLoading}
          error={error ? String(error) : undefined}
        />
      )}
    </>
  );
});
