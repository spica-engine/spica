import {memo, useEffect, useRef, type FC} from "react";
import TerminalLine from "../../atoms/terminal-line/TerminalLine";
import type {TerminalLineEntry} from "../../../types/version-control";
import styles from "./TerminalOutput.module.scss";

type TerminalOutputProps = {
  lines: TerminalLineEntry[];
};

const TerminalOutput: FC<TerminalOutputProps> = ({lines}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({behavior: "smooth"});
  }, [lines]);

  return (
    <div className={styles.container}>
      {lines.map((entry) => (
        <TerminalLine key={entry.id} text={entry.text} variant={entry.variant} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
};

export default memo(TerminalOutput);
