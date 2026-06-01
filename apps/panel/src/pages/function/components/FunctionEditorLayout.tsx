import type {ReactNode} from "react";
import styles from "./FunctionEditorLayout.module.scss";

type FunctionEditorLayoutProps = {
  showSidebar: boolean;
  header: ReactNode;
  editor: ReactNode;
  footer: ReactNode;
  sidebar: ReactNode;
};

const FunctionEditorLayout = ({showSidebar, header, editor, footer, sidebar}: FunctionEditorLayoutProps) => {
  return (
    <div className={styles.container}>
      <div className={`${styles.codeArea} ${!showSidebar ? styles.codeAreaExpanded : ""}`}>
        {header}
        {editor}
        {footer}
      </div>
      <div className={`${styles.sidebar} ${!showSidebar ? styles.sidebarHidden : ""}`}>{sidebar}</div>
    </div>
  );
};

export default FunctionEditorLayout;