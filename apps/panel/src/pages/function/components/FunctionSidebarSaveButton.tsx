import {Button, Icon} from "oziko-ui-kit";
import styles from "./FunctionSidebarSaveButton.module.scss";

type FunctionSidebarSaveButtonProps = {
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
};

const FunctionSidebarSaveButton = ({disabled, loading, onClick}: FunctionSidebarSaveButtonProps) => {
  return (
    <Button
      fullWidth
      variant="solid"
      color="primary"
      className={styles.button}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon name="save" size="sm" />
      {loading ? "Saving..." : "Save"}
    </Button>
  );
};

export default FunctionSidebarSaveButton;