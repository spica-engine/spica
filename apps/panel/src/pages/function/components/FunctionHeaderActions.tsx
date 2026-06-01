import {Icon} from "oziko-ui-kit";
import styles from "./FunctionHeaderActions.module.scss";

type FunctionHeaderActionsProps = {
  onOpenConfiguration: () => void;
  onSave: () => void;
  onToggleSidebar: () => void;
  showSidebar: boolean;
  disabled: boolean;
  isSaving: boolean;
  lastSaveTime: Date | null;
};

const FunctionHeaderActions = ({
  onOpenConfiguration,
  onSave,
  onToggleSidebar,
  showSidebar,
  disabled,
  isSaving,
  lastSaveTime,
}: FunctionHeaderActionsProps) => {
  return (
    <div className={styles.actions}>
      <button className={styles.button} title="Edit configuration" onClick={onOpenConfiguration}>
        <Icon name="pencil" size="sm" />
      </button>
      <button className={styles.button} title="Save code" onClick={onSave} disabled={disabled}>
        <Icon name="save" size="sm" />
      </button>
      {lastSaveTime && !isSaving && <span className={styles.saveStatus}>Saved {lastSaveTime.toLocaleTimeString()}</span>}
      {isSaving && <span className={styles.saveStatus}>Saving...</span>}
      <button className={styles.button} title="Toggle sidebar" onClick={onToggleSidebar}>
        <Icon name={showSidebar ? "chevronRight" : "chevronLeft"} size="sm" />
      </button>
    </div>
  );
};

export default FunctionHeaderActions;