import FunctionLogView from "./FunctionLogView";
import styles from "./FunctionLogFooter.module.scss";

type FunctionLogFooterProps = {
  functionId: string;
  functionName: string;
  defaultHandlerName: string;
  isOpen: boolean;
  onToggle: () => void;
};

const FunctionLogFooter = ({
  functionId,
  functionName,
  defaultHandlerName,
  isOpen,
  onToggle,
}: FunctionLogFooterProps) => {
  return (
    <div className={styles.root}>
      <FunctionLogView
        functionId={functionId}
        functionName={functionName}
        defaultHandlerName={defaultHandlerName}
        isOpen={isOpen}
        onToggle={onToggle}
      />
    </div>
  );
};

export default FunctionLogFooter;