/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React, { useCallback } from "react";
import { useUpdateWebhookMutation, type Webhook } from "../../../store/api/webhookApi";
import styles from "../Webhook.module.scss";

type WebhookDetailsProps = {
  webhook: Webhook;
};

export const WebhookDetails: React.FC<WebhookDetailsProps> = ({ webhook }) => {
  const isActive = webhook.trigger?.active ?? false;
  const [updateWebhook] = useUpdateWebhookMutation();

  const handleToggleActive = useCallback(async () => {
    if (!webhook._id) return;
    try {
      await updateWebhook({
        id: webhook._id,
        body: {
          title: webhook.title,
          url: webhook.url,
          body: webhook.body,
          trigger: {
            ...webhook.trigger,
            active: !isActive,
          },
        },
      }).unwrap();
    } catch {
      // error handled by RTK Query
    }
  }, [webhook, isActive, updateWebhook]);

  return (
    <div className={styles.detailCard}>
      <div className={styles.detailHeader}>
        <span className={styles.detailTitle}>{webhook.title || webhook.url}</span>
        <span
          className={`${styles.detailStatus} ${
            isActive ? styles.statusActive : styles.statusInactive
          }`}
        >
          <svg width="7" height="7" viewBox="0 0 8 8" aria-hidden="true">
            <circle cx="4" cy="4" r="4" fill="currentColor" />
          </svg>
          {isActive ? "Active" : "Inactive"}
        </span>
      </div>

      <div className={styles.detailGrid}>
        <div className={styles.detailCell}>
          <span className={styles.dcLabel}>Id</span>
          <span className={`${styles.dcValue} ${styles.dcMono}`}>{webhook._id ?? "-"}</span>
        </div>
        <div className={`${styles.detailCell} ${styles.detailCellRight}`}>
          <span className={styles.dcLabel}>Last Edit</span>
          <span className={`${styles.dcValue} ${styles.dcBold}`}>
            {webhook.updated_at || "-"}
          </span>
        </div>
        <div className={styles.detailCell}>
          <span className={styles.dcLabel}>Trigger</span>
          <span className={styles.dcValue}>
            {`${webhook.trigger?.options?.collection ?? "-"}/${
              webhook.trigger?.options?.type ?? "-"
            }`}
          </span>
        </div>
        <div className={`${styles.detailCell} ${styles.detailCellRight}`}>
          <span className={styles.dcLabel}>Running</span>
          <span className={styles.runningCell}>
            <button
              className={`${styles.toggleSwitch} ${isActive ? styles.toggleSwitchOn : ""}`}
              onClick={handleToggleActive}
              type="button"
              aria-pressed={isActive}
            />
            <span className={styles.toggleLabel}>{isActive ? "true" : "false"}</span>
          </span>
        </div>
        <div className={styles.detailCell}>
          <span className={styles.dcLabel}>Last 7 Days</span>
          <span className={`${styles.dcValue} ${styles.dcBold}`}>
            {webhook.last7Days != null ? `${webhook.last7Days} times` : "-"}
          </span>
        </div>
        <div className={`${styles.detailCell} ${styles.detailCellRight}`}>
          <span className={styles.dcLabel}>Created By</span>
          <span className={`${styles.dcValue} ${styles.dcBold}`}>
            {webhook.created_by ?? "-"}
          </span>
        </div>
      </div>

      <div className={`${styles.detailCell} ${styles.descRow}`}>
        <span className={styles.dcLabel}>Description</span>
        <span className={styles.descText}>
          {webhook.body || (
            <em className={styles.noDescription}>No description</em>
          )}
        </span>
      </div>
    </div>
  );
};

export default WebhookDetails;
