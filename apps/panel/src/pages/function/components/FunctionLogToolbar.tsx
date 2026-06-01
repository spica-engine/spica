import {Popover} from "oziko-ui-kit";
import type {DateRange} from "../../../utils/functionLogUtils";
import {formatToolbarDate} from "../../../utils/functionLogUtils";
import styles from "./FunctionLogView.module.scss";

type FunctionLogToolbarProps = {
  queryRange: DateRange;
  draftBegin: string;
  draftEnd: string;
  isFilterOpen: boolean;
  isFilterApplied: boolean;
  isFetching: boolean;
  isClearingLogs: boolean;
  hasLogs: boolean;
  onDraftBeginChange: (value: string) => void;
  onDraftEndChange: (value: string) => void;
  onFilterToggle: () => void;
  onFilterClose: () => void;
  onFilterReset: () => void;
  onFilterApply: () => void;
  onRefresh: () => void;
  onClear: () => void;
};

const FunctionLogToolbar = ({
  queryRange,
  draftBegin,
  draftEnd,
  isFilterOpen,
  isFilterApplied,
  isFetching,
  isClearingLogs,
  hasLogs,
  onDraftBeginChange,
  onDraftEndChange,
  onFilterToggle,
  onFilterClose,
  onFilterReset,
  onFilterApply,
  onRefresh,
  onClear,
}: FunctionLogToolbarProps) => {
  return (
    <div className={styles.toolbar}>
      <div className={`${styles.toolDate} ${styles.toolDateStatic}`}>
        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <span className={styles.toolDateValue}>
          {formatToolbarDate(queryRange.begin)} - {formatToolbarDate(queryRange.end)}
        </span>
      </div>

      <div className={styles.toolbarActions}>
        <Popover
          open={isFilterOpen}
          onClose={onFilterClose}
          placement="bottomEnd"
          containerProps={{className: styles.filterAnchor}}
          contentProps={{
            style: {
              padding: 0,
              background: "transparent",
              boxShadow: "none",
              border: "none",
            },
          }}
          content={
            <div className={styles.filterPanel}>
              <div className={styles.filterTitle}>Filter Logs</div>
              <label className={styles.filterRow}>
                <span className={styles.filterLabel}>From</span>
                <input
                  className={styles.filterInput}
                  type="datetime-local"
                  value={draftBegin}
                  onChange={event => onDraftBeginChange(event.target.value)}
                />
              </label>
              <label className={styles.filterRow}>
                <span className={styles.filterLabel}>To</span>
                <input
                  className={styles.filterInput}
                  type="datetime-local"
                  value={draftEnd}
                  onChange={event => onDraftEndChange(event.target.value)}
                />
              </label>
              <div className={styles.filterActions}>
                <button type="button" className={styles.filterReset} onClick={onFilterReset}>
                  Reset
                </button>
                <button type="button" className={styles.filterApply} onClick={onFilterApply}>
                  Apply
                </button>
              </div>
            </div>
          }
        >
          <button
            type="button"
            className={`${styles.toolbarButton} ${isFilterApplied ? styles.toolbarButtonActive : ""}`}
            onClick={onFilterToggle}
          >
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            Filter
          </button>
        </Popover>
        <button type="button" className={styles.toolbarButton} onClick={onRefresh} disabled={isFetching}>
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.13-3.36L23 10" />
            <path d="M20.49 15a9 9 0 0 1-14.13 3.36L1 14" />
          </svg>
          Refresh
        </button>
        <button type="button" className={styles.toolbarButton} onClick={onClear} disabled={isClearingLogs || !hasLogs}>
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
          Clear
        </button>
      </div>
    </div>
  );
};

export default FunctionLogToolbar;