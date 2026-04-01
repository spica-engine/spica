import React, { useState, type FC, type ReactNode } from "react";
import { Icon } from "oziko-ui-kit";
import Confirmation from "../../molecules/confirmation/Confirmation";

type DeleteEntityProps = {
  entityId: string;
  entityName: string;
  entityLabel: string;
  deleteMutation: (id: string) => { unwrap: () => Promise<void> };
  onDeleted?: () => void;
  children: (props: {
    isOpen: boolean;
    onOpen: (e: React.MouseEvent) => void;
    onClose: () => void;
  }) => ReactNode;
};

const DeleteEntity: FC<DeleteEntityProps> = ({
  entityId,
  entityName,
  entityLabel,
  deleteMutation,
  onDeleted,
  children,
}) => {
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);

  const handleDelete = async () => {
    await deleteMutation(entityId).unwrap();
    setIsConfirmationOpen(false);
    onDeleted?.();
  };

  const handleCancel = () => {
    setIsConfirmationOpen(false);
  };

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsConfirmationOpen(true);
  };

  return (
    <>
      {children({
        isOpen: isConfirmationOpen,
        onOpen: handleOpen,
        onClose: handleCancel,
      })}
      {isConfirmationOpen && (
        <Confirmation
          title={`DELETE ${entityLabel}`}
          description={
            <>
              <span>
                This action will permanently delete this {entityLabel.toLowerCase()} and revoke all
                associated access. This cannot be undone.
              </span>
              <span>
                Please type <strong>{entityName}</strong> to confirm deletion.
              </span>
            </>
          }
          inputPlaceholder="Type Here"
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
          showInput
          confirmCondition={(val) => val === entityName}
          onConfirm={handleDelete}
          onCancel={handleCancel}
        />
      )}
    </>
  );
};

export default DeleteEntity;
