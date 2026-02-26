import {memo, useState, useCallback, type FC, type KeyboardEvent} from "react";
import styles from "./TerminalInput.module.scss";

type TerminalInputProps = {
  onSubmit: (command: string) => void;
  disabled?: boolean;
};

const TerminalInput: FC<TerminalInputProps> = ({onSubmit, disabled = false}) => {
  const [value, setValue] = useState("");

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        const trimmed = value.trim();
        if (!trimmed) return;
        onSubmit(trimmed);
        setValue("");
      }
    },
    [value, onSubmit]
  );

  return (
    <div className={styles.container}>
      <input
        className={styles.input}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type your GIT command here …"
        disabled={disabled}
        autoFocus
      />
    </div>
  );
};

export default memo(TerminalInput);
