/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React, { useState } from "react";
import Loader from "../../../components/atoms/loader/Loader";
import type { WebhookLog } from "../../../store/api/webhookApi";
import styles from "../Webhook.module.scss";
import { FlexElement } from "oziko-ui-kit";

type LogFilter = "all" | "success" | "error";

type WebhookLogsProps = {
  logs: WebhookLog[];
  isLoading: boolean;
};

const getLogDotClass = (log: WebhookLog): string => {
  if (log.succeed) return styles.dotOk;
  if (log.content?.error) return styles.dotErr;
  return styles.dotInfo;
};

export const WebhookLogs: React.FC<WebhookLogsProps> = ({ logs, isLoading }) => {
  const [filter, setFilter] = useState<LogFilter>("all");

  const filteredLogs = logs.filter((log) => {
    if (filter === "all") return true;
    if (filter === "success") return log.succeed;
    if (filter === "error") return !log.succeed;
    return true;
  });

  return (
    <div className={styles.logsSection}>
      <div className={styles.logsHead}>
        <span className={styles.logsTitle}>Logs</span>
        <div className={styles.logsFilter}>
          <button
            type="button"
            className={`${styles.logFilterBtn} ${filter === "all" ? styles.logFilterBtnActive : ""}`}
            onClick={() => setFilter("all")}
          >
            All
          </button>
          <button
            type="button"
            className={`${styles.logFilterBtn} ${filter === "success" ? styles.logFilterBtnActive : ""}`}
            onClick={() => setFilter("success")}
          >
            <span className={`${styles.logDot} ${styles.dotOk}`} />
            Success
          </button>
          <button
            type="button"
            className={`${styles.logFilterBtn} ${filter === "error" ? styles.logFilterBtnActive : ""}`}
            onClick={() => setFilter("error")}
          >
            <span className={`${styles.logDot} ${styles.dotErr}`} />
            Error
          </button>
        </div>
      </div>

      <div className={styles.logsTable}>
        {isLoading && (
          <FlexElement dimensionX="fill" alignment="center" className={styles.logsEmpty}>
            <Loader />
          </FlexElement>
        )}
        {!isLoading && filteredLogs.length === 0 && (
          <div className={styles.logsEmptyRow}>
            <span>No logs available for this webhook.</span>
          </div>
        )}
        {!isLoading &&
          filteredLogs.map((log, i) => {
            const errorSuffix = log.content?.error ? `: ${log.content.error}` : "";
            const statusText = log.succeed
              ? `Success (${log.content?.response?.status ?? "-"})`
              : `Failed${errorSuffix}`;
            const dateStr = log.created_at
              ? new Date(log.created_at).toLocaleString()
              : "-";
            return (
              <div key={log._id ?? i} className={styles.logRow}>
                <div className={`${styles.logDot} ${getLogDotClass(log)}`} />
                <span className={styles.logMsg}>{statusText}</span>
                <span className={styles.logTs}>{dateStr}</span>
              </div>
            );
          })}
      </div>
    </div>
  );
};

export default WebhookLogs;
