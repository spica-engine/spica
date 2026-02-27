import {memo, type FC} from "react";
import styles from "./TerminalLine.module.scss";
import type {TerminalLineVariant} from "../../../types/version-control";

type TerminalLineProps = {
  text: string;
  variant?: TerminalLineVariant;
};

const PROMPT_PREFIX = "user@spica % ";

const TerminalLine: FC<TerminalLineProps> = ({text, variant = "output"}) => {
  return (
    <div className={`${styles.line} ${styles[variant]}`}>
      {variant === "command" && (
        <span className={styles.prompt}>{PROMPT_PREFIX}</span>
      )}
      <span>{text}</span>
    </div>
  );
};

export default memo(TerminalLine);
