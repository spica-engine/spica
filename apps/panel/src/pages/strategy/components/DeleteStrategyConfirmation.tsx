/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React, { memo } from "react";
import Confirmation from "../../../components/molecules/confirmation/Confirmation";
import type { AuthenticationStrategy } from "../../../store/api/authenticationStrategyApi";
import styles from "./DeleteStrategyConfirmation.module.scss";

type DeleteStrategyConfirmationProps = {
  strategy: AuthenticationStrategy;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
};

const DeleteStrategyConfirmation = memo(function DeleteStrategyConfirmation({
  strategy,
  onConfirm,
  onCancel,
  isLoading
}: DeleteStrategyConfirmationProps) {
  return (
    <Confirmation
      title="Delete Strategy"
      description={
        <>
          <span className={styles.confirmText}>
            This action will permanently delete this strategy.
          </span>
          <span className={styles.confirmHint}>
            Please type <strong>{strategy.name}</strong> to confirm deletion.
          </span>
        </>
      }
      confirmLabel="Delete"
      cancelLabel="Cancel"
      showInput
      inputPlaceholder="Strategy name"
      confirmCondition={input => input.trim() === strategy.name?.trim()}
      onConfirm={onConfirm}
      onCancel={onCancel}
      loading={isLoading}
    />
  );
});

export default DeleteStrategyConfirmation;
