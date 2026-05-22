import styles from "./FunctionLogView.module.scss";

type FunctionLogRailProps = {
  functionName: string;
  isOpen: boolean;
  resultCount: number;
  onToggle: () => void;
};

const FunctionLogRail = ({functionName, isOpen, resultCount, onToggle}: FunctionLogRailProps) => {
  return (
    <div className={styles.logRail}>
      <button type="button" className={styles.logRailToggle} onClick={onToggle}>
        <svg
          width="12"
          height="12"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
          style={{transform: isOpen ? "rotate(180deg)" : "none"}}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
        Logs
      </button>
      <div className={styles.logRailMeta}>
        <span>{functionName}</span>
        {isOpen && <span>{resultCount} results</span>}
      </div>
    </div>
  );
};

export default FunctionLogRail;