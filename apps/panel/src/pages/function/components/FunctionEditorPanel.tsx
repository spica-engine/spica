import CodeEditor from "./CodeEditor";
import styles from "./FunctionEditorPanel.module.scss";

type FunctionEditorPanelProps = {
  code: string;
  language: "javascript" | "typescript";
  onChange: (value: string) => void;
  onSave: () => void;
  functionId: string;
  extraLibs: Record<string, string>;
};

const FunctionEditorPanel = ({
  code,
  language,
  onChange,
  onSave,
  functionId,
  extraLibs,
}: FunctionEditorPanelProps) => {
  return (
    <div className={styles.wrapper}>
      <CodeEditor
        value={code}
        language={language}
        onChange={onChange}
        onSave={onSave}
        functionId={functionId}
        extraLibs={extraLibs}
      />
    </div>
  );
};

export default FunctionEditorPanel;