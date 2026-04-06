/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React from "react";
import Page from "../../../components/organisms/page-layout/Page";
import { InfoRow } from "../../../components/prefabs/navigations/webhook/InfoRow";
import type { Webhook } from "../../../store/api/webhookApi";
import styles from "../Webhook.module.scss";

type WebhookDetailsProps = {
  webhook: Webhook;
};

export const WebhookDetails: React.FC<WebhookDetailsProps> = ({ webhook }) => (
  <Page title={webhook.title || webhook.url}>
    <div className={styles.infoContainer}>
      <InfoRow
        label="ID"
        value={webhook._id}
        valueClassName={styles.value}
      />
      <InfoRow
        label="Last Edit"
        value={webhook.updated_at || "-"}
        valueClassName={styles.value}
      />
      <InfoRow
        label="Trigger"
        value={`${webhook.trigger?.options?.collection}/${webhook.trigger?.options?.type || "-"}`}
        valueClassName={styles.value}
      />
      <InfoRow
        label="Running"
        value={webhook.trigger?.active ? "Yes" : "No"}
        valueClassName={styles.value}
      />
      <InfoRow
        label="Last 7 Days"
        value={webhook.last7Days ?? "-"}
        valueClassName={styles.value}
      />
      <InfoRow
        label="Created By"
        value={webhook.created_by ?? "-"}
        valueClassName={styles.value}
      />
      <InfoRow
        label="Description"
        value={webhook.body || webhook.title || "-"}
        valueClassName={styles.value}
        className={styles.infoFullWidth}
      />
    </div>
  </Page>
);

export default WebhookDetails;
