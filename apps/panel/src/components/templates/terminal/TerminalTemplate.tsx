import {memo, type FC} from "react";
import {useTerminal} from "../../../hooks/useTerminal";
import Page from "../../organisms/page-layout/Page";
import TerminalOutput from "../../organisms/terminal-output/TerminalOutput";
import TerminalInput from "../../molecules/terminal-input/TerminalInput";
import styles from "./TerminalTemplate.module.scss";

const TerminalTemplate: FC = () => {
  const {history, handleSubmit, isLoading} = useTerminal();

  return (
    <Page
      title="TERMINAL"
      className={styles.container}
      contentHeaderProps={{className: styles.terminalHeader}}
      contentBodyProps={{className: styles.terminalBody}}
    >
      <TerminalOutput lines={history} />
      <TerminalInput onSubmit={handleSubmit} disabled={isLoading} />
    </Page>
  );
};

export default memo(TerminalTemplate);
