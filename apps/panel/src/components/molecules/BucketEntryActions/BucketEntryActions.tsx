import {Button, FlexElement, FluidContainer, Icon, Text} from "oziko-ui-kit";
import styles from "./BucketEntryActions.module.scss";

export interface BucketEntryActionsProps {
  onSubmit: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  error?: string | null;
  submitButtonText?: string;
  cancelButtonText?: string;
}

export const BucketEntryActions = ({
  onSubmit,
  onCancel,
  isLoading = false,
  error,
  submitButtonText = "Save and close",
  cancelButtonText = "Cancel"
}: BucketEntryActionsProps) => {
  return (
    <FlexElement className={styles.footer}>
      {error && (
        <Text className={styles.errorText} variant="danger">
          {error}
        </Text>
      )}
      <FlexElement gap={12}>
        {onCancel && (
          <Button onClick={onCancel} disabled={isLoading} variant="outlined">
            {cancelButtonText}
          </Button>
        )}
        <Button onClick={onSubmit} loading={isLoading} disabled={isLoading} className={styles.saveButton}>
          <FluidContainer
            prefix={{children: <Icon name="save" />}}
            root={{children: submitButtonText}}
          />
        </Button>
      </FlexElement>
    </FlexElement>
  );
};

export default BucketEntryActions;

