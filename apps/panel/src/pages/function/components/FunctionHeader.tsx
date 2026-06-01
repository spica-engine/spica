import type {KeyboardEventHandler} from "react";
import EditableFunctionName from "./EditableFunctionName";
import FunctionHeaderActions from "./FunctionHeaderActions";
import styles from "./FunctionHeader.module.scss";

type FunctionHeaderProps = {
  functionName: string;
  isNameEditing: boolean;
  editingName: string;
  onEditStart: () => void;
  onEditingNameChange: (value: string) => void;
  onEditSave: () => void;
  onEditKeyDown: KeyboardEventHandler<HTMLInputElement>;
  onOpenConfiguration: () => void;
  onSaveCode: () => void;
  onToggleSidebar: () => void;
  showSidebar: boolean;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  lastSaveTime: Date | null;
};

const FunctionHeader = ({
  functionName,
  isNameEditing,
  editingName,
  onEditStart,
  onEditingNameChange,
  onEditSave,
  onEditKeyDown,
  onOpenConfiguration,
  onSaveCode,
  onToggleSidebar,
  showSidebar,
  hasUnsavedChanges,
  isSaving,
  lastSaveTime,
}: FunctionHeaderProps) => {
  return (
    <div className={styles.tabBar}>
      <div className={styles.tab}>
        <svg className={styles.icon} width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
        <EditableFunctionName
          value={functionName}
          editingValue={editingName}
          isEditing={isNameEditing}
          onStartEdit={onEditStart}
          onChange={onEditingNameChange}
          onSave={onEditSave}
          onKeyDown={onEditKeyDown}
        />
        <span className={styles.tabDot} />
        <FunctionHeaderActions
          onOpenConfiguration={onOpenConfiguration}
          onSave={onSaveCode}
          onToggleSidebar={onToggleSidebar}
          showSidebar={showSidebar}
          disabled={isSaving || !hasUnsavedChanges}
          isSaving={isSaving}
          lastSaveTime={lastSaveTime}
        />
      </div>
    </div>
  );
};

export default FunctionHeader;