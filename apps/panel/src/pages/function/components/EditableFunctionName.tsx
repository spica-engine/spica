import type {KeyboardEventHandler} from "react";
import styles from "./EditableFunctionName.module.scss";

type EditableFunctionNameProps = {
  value: string;
  editingValue: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onChange: (value: string) => void;
  onSave: () => void;
  onKeyDown: KeyboardEventHandler<HTMLInputElement>;
};

const EditableFunctionName = ({
  value,
  editingValue,
  isEditing,
  onStartEdit,
  onChange,
  onSave,
  onKeyDown,
}: EditableFunctionNameProps) => {
  if (isEditing) {
    return (
      <input
        className={styles.input}
        value={editingValue}
        autoFocus
        onChange={event => onChange(event.target.value)}
        onBlur={onSave}
        onKeyDown={onKeyDown}
      />
    );
  }

  return (
    <span className={styles.name} onClick={onStartEdit} title="Click to rename">
      {value}
    </span>
  );
};

export default EditableFunctionName;