import {Icon, type TypeAccordionItem} from "oziko-ui-kit";
import type {FunctionLog} from "../../store/api/functionApi";
import styles from "./FunctionLogPage.module.scss";
import {LOG_LEVEL_LABELS as LEVEL_LABELS} from "../../utils/functionLogLevels";

const SEVERITY_CLASS: Record<number, string> = {
  0: styles.severityDebug,
  1: styles.severityLog,
  2: styles.severityInfo,
  3: styles.severityWarning,
  4: styles.severityError
};

function formatTimestamp(log: FunctionLog): string {
  const ts = Number.parseInt(log._id.substring(0, 8), 16) * 1000;
  return new Date(ts).toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

export function buildAccordionItem(
  log: FunctionLog,
  functionName: string,
  handlerName: string
): TypeAccordionItem {
  const timestamp = formatTimestamp(log);
  const severity = LEVEL_LABELS[log.level] ?? "Unknown";

  const title = (
    <div className={styles.logRowHeader}>
      <div className={styles.logRowCell}>
        <div className={`${styles.severityBadge} ${SEVERITY_CLASS[log.level] ?? ""}`}>
          <Icon name="help" />
        </div>
      </div>
      <div className={styles.logRowCell}>{timestamp}</div>
      <div className={styles.logRowCell}>{functionName}</div>
      <div className={styles.logRowCell}>{handlerName}</div>
      <div className={styles.logRowCell}>{log.content}</div>
    </div>
  );

  const content = (
    <div className={styles.logDetail}>
      <div className={styles.detailRow}>
        <span className={styles.detailLabel}>Log ID</span>
        <span className={styles.detailValue}>{log._id}</span>
      </div>
      <div className={styles.detailRow}>
        <span className={styles.detailLabel}>Event ID</span>
        <span className={styles.detailValue}>{log.event_id}</span>
      </div>
      <div className={styles.detailRow}>
        <span className={styles.detailLabel}>Function</span>
        <span className={styles.detailValue}>
          {functionName} ({log.function})
        </span>
      </div>
      <div className={styles.detailRow}>
        <span className={styles.detailLabel}>Handler</span>
        <span className={styles.detailValue}>{handlerName}</span>
      </div>

      <div className={styles.detailRow}>
        <span className={styles.detailLabel}>Channel</span>
        <span className={styles.detailValue}>{log.channel}</span>
      </div>
      <div className={styles.detailRow}>
        <span className={styles.detailLabel}>Timestamp</span>
        <span className={styles.detailValue}>{timestamp}</span>
      </div>
      <div className={styles.detailRow}>
        <span className={styles.detailLabel}>Content</span>
        <span className={styles.detailValue}>{log.content}</span>
      </div>
      <div className={styles.detailJson}>
        {JSON.stringify(
          {
            _id: log._id,
            function: log.function,
            event_id: log.event_id,
            content: log.content,
            channel: log.channel,
            level: log.level,
            created_at: log.created_at
          },
          null,
          2
        )}
      </div>
    </div>
  );

  return {title, content, className: styles.logRow};
}
