import React, { memo } from "react";
import { Icon } from "oziko-ui-kit";
import Confirmation from "../../../components/molecules/confirmation/Confirmation";

type DeleteConfirmationProps = {
  itemType: "secret" | "variable";
  itemKey: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
};

const DeleteConfirmation = ({ itemType, itemKey, onConfirm, onCancel, isLoading }: DeleteConfirmationProps) => (
  <Confirmation
    title={`DELETE ${itemType.toUpperCase()}`}
    description={
      <>
        This action will <b>permanently</b> delete the {itemType} <b>{itemKey}</b>. This cannot be undone.
      </>
    }
    showInput={false}
    confirmLabel={
      <>
        <Icon name="delete" /> Delete
      </>
    }
    onConfirm={onConfirm}
    onCancel={onCancel}
    loading={isLoading}
  />
);

export default memo(DeleteConfirmation);
