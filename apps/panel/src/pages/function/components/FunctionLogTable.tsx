import {Fragment} from "react";
import type {FunctionLog} from "../../../store/api/functionApi";
import {
  LOG_LEVEL_LABELS,
  SEVERITY_CHIPS,
  getSeverityBadge,
  getSeverityFilter,
  type SeverityFilter,
} from "../../../utils/functionLogLevels";
import {formatRowTimestamp, getLogDate} from "../../../utils/functionLogUtils";
import styles from "./FunctionLogView.module.scss";

const ROW_SEVERITY_CLASS: Record<SeverityFilter, string> = {
  all: styles.severityAll,
  info: styles.severityInfo,
  warning: styles.severityWarning,
  error: styles.severityError,
  debug: styles.severityDebug,
};

type FunctionLogTableProps = {
  logs: FunctionLog[];
  isFetching: boolean;
  functionName: string;
  defaultHandlerName: string;
  searchQuery: string;
  severityFilter: SeverityFilter;
  sortDirection: "asc" | "desc";
  expandedLogIds: string[];
  onSearchChange: (value: string) => void;
  onSeverityChange: (filter: SeverityFilter) => void;
  onSortDirectionChange: (direction: "asc" | "desc") => void;
  onToggleRow: (id: string) => void;
};

const FunctionLogTable = ({
  logs,
  isFetching,
  functionName,
  defaultHandlerName,
  searchQuery,
  severityFilter,
  sortDirection,
  expandedLogIds,
  onSearchChange,
  onSeverityChange,
  onSortDirectionChange,
  onToggleRow,
}: FunctionLogTableProps) => {
  return (
    <div className={styles.logSection}>
      <div className={styles.logToolbar}>
        <label className={styles.searchField}>
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search logs..."
            value={searchQuery}
            onChange={event => onSearchChange(event.target.value)}
          />
        </label>

        <div className={styles.severityChips}>
          {SEVERITY_CHIPS.map(chip => {
            const selected = severityFilter === chip.key;
            const chipClassName = chip.key === "all" ? styles.severityAll : ROW_SEVERITY_CLASS[chip.key];

            return (
              <button
                key={chip.key}
                type="button"
                className={`${styles.severityChip} ${chipClassName} ${selected ? styles.severityChipSelected : ""}`}
                onClick={() => onSeverityChange(chip.key)}
              >
                {chip.dotLabel && <span className={styles.severityDot}>{chip.dotLabel}</span>}
                {chip.label}
              </button>
            );
          })}
        </div>

        <div className={styles.logCount}>
          <strong>{logs.length}</strong> results
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.logTable}>
          <thead>
            <tr>
              <th className={styles.expandColumn} />
              <th className={styles.severityColumn}>Sev</th>
              <th>
                <button
                  type="button"
                  className={styles.sortButton}
                  onClick={() => onSortDirectionChange(sortDirection === "asc" ? "desc" : "asc")}
                >
                  Timestamp
                  <svg
                    width="10"
                    height="10"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    style={{transform: sortDirection === "asc" ? "rotate(180deg)" : "none"}}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              </th>
              <th>Function</th>
              <th>Handler</th>
              <th>Content</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className={styles.emptyState}>
                    <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="11" cy="11" r="8" />
                      <path d="M21 21l-4.35-4.35" />
                    </svg>
                    <span>{isFetching ? "Loading logs..." : "No logs match your filters"}</span>
                  </div>
                </td>
              </tr>
            ) : (
              logs.map(log => {
                const rowSeverity = getSeverityFilter(log.level);
                const expanded = expandedLogIds.includes(log._id);

                return (
                  <Fragment key={log._id}>
                    <tr className={`${styles.logRow} ${expanded ? styles.logRowExpanded : ""}`} onClick={() => onToggleRow(log._id)}>
                      <td className={styles.expandColumn}>
                        <button
                          type="button"
                          className={styles.expandButton}
                          onClick={event => {
                            event.stopPropagation();
                            onToggleRow(log._id);
                          }}
                        >
                          <svg
                            width="11"
                            height="11"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            style={{transform: expanded ? "rotate(90deg)" : "none"}}
                          >
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </button>
                      </td>
                      <td className={styles.severityColumn}>
                        <span className={`${styles.severityBadge} ${ROW_SEVERITY_CLASS[rowSeverity]}`}>
                          {getSeverityBadge(log.level)}
                        </span>
                      </td>
                      <td className={styles.timestampCell}>{formatRowTimestamp(log)}</td>
                      <td>
                        <span className={styles.functionBadge}>{functionName}</span>
                      </td>
                      <td>
                        <span className={styles.handlerBadge}>{defaultHandlerName}</span>
                      </td>
                      <td className={styles.contentCell}>{log.content}</td>
                    </tr>
                    {expanded && (
                      <tr className={styles.detailRow}>
                        <td colSpan={6}>
                          <div className={styles.detailBody}>
                            <div className={styles.detailMeta}>
                              <div className={styles.detailMetaItem}>
                                <span className={styles.detailMetaLabel}>Event ID</span>
                                <span className={styles.detailMetaValue}>{log.event_id || "n/a"}</span>
                              </div>
                              <div className={styles.detailMetaItem}>
                                <span className={styles.detailMetaLabel}>Channel</span>
                                <span className={styles.detailMetaValue}>{log.channel}</span>
                              </div>
                              <div className={styles.detailMetaItem}>
                                <span className={styles.detailMetaLabel}>Severity</span>
                                <span className={styles.detailMetaValue}>{LOG_LEVEL_LABELS[log.level] ?? "Unknown"}</span>
                              </div>
                            </div>
                            <pre className={styles.detailJson}>
                              {JSON.stringify(
                                {
                                  _id: log._id,
                                  function: log.function,
                                  function_name: functionName,
                                  handler: defaultHandlerName,
                                  event_id: log.event_id,
                                  channel: log.channel,
                                  level: log.level,
                                  content: log.content,
                                  created_at: log.created_at || getLogDate(log).toISOString(),
                                },
                                null,
                                2
                              )}
                            </pre>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FunctionLogTable;