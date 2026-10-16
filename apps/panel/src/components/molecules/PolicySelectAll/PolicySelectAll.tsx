import {Button} from "oziko-ui-kit";
import styles from "./PolicySelectAll.module.scss";

export interface PolicySelectAllProps {
  selectedCount: number;
  totalCount: number;
  onToggle: (selectAll: boolean) => void;
  disabled?: boolean;
}

export const PolicySelectAll = ({
  selectedCount,
  totalCount,
  onToggle,
  disabled = false
}: PolicySelectAllProps) => {
  const allSelected = totalCount > 0 && selectedCount === totalCount;

  return (
    <div className={styles.container}>
      <span className={styles.counter}>
        {selectedCount} of {totalCount} selected
      </span>
      <Button
        variant="outlined"
        color="default"
        className={styles.toggle}
        disabled={disabled || totalCount === 0}
        onClick={() => onToggle(!allSelected)}
      >
        {allSelected ? "Clear all policies" : "Select all policies"}
      </Button>
    </div>
  );
};

export default PolicySelectAll;
