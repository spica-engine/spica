import {Icon} from "oziko-ui-kit";
import Confirmation from "../../../components/molecules/confirmation/Confirmation";

type FunctionDeleteConfirmationProps = {
  isOpen: boolean;
  loading: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

const FunctionDeleteConfirmation = ({
  isOpen,
  loading,
  error,
  onConfirm,
  onCancel,
}: FunctionDeleteConfirmationProps) => {
  if (!isOpen) {
    return null;
  }

  return (
    <Confirmation
      title="DELETE FUNCTION"
      description={
        <>
          <span>This action will permanently delete this function.</span>
          <span>
            Please type <strong>agree</strong> to confirm deletion.
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
      confirmCondition={input => input === "agree"}
      showInput
      onConfirm={onConfirm}
      onCancel={onCancel}
      loading={loading}
      error={error}
    />
  );
};

export default FunctionDeleteConfirmation;