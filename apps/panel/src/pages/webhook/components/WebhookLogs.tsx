/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React from "react";
import Page from "../../../components/organisms/page-layout/Page";
import Loader from "../../../components/atoms/loader/Loader";
import type { WebhookLog } from "../../../store/api/webhookApi";
import styles from "../Webhook.module.scss";
import { FlexElement, FluidContainer, Text } from "oziko-ui-kit";

type WebhookLogsProps = {
  logs: WebhookLog[];
  isLoading: boolean;
};

export const WebhookLogs: React.FC<WebhookLogsProps> = ({ logs, isLoading }) => (
  <Page
    title="LOGS"
    contentBodyProps={{ className: styles.logsList }}
    className={styles.logsPage}
  >
    <FlexElement
      direction="vertical"
      gap={0}
      alignment="center"
      dimensionX="fill"
      dimensionY="fill"
    >
      {isLoading && <Loader />}
      {!isLoading && (logs?.length ?? 0) === 0 && (
        <FlexElement dimensionX="fill" alignment="center" dimensionY="fill">
          There is no data
        </FlexElement>
      )}
      {!isLoading &&
        (logs?.length ?? 0) > 0 &&
        logs.map((log) => {
          const errorSuffix = log.content?.error ? `: ${log.content.error}` : "";
          const statusText = log.succeed
            ? `Success (${log.content?.response?.status ?? "-"})`
            : `Failed${errorSuffix}`;
          const dateStr = log.created_at
            ? new Date(log.created_at).toLocaleString()
            : "-";
          return (
            <FluidContainer
              key={log._id}
              dimensionX="fill"
              dimensionY={25}
              alignment="center"
              mode="fill"
              gap={0}
              root={{
                children: <Text>{statusText}</Text>,
                alignment: "leftTop",
              }}
              suffix={{ children: <Text>{dateStr}</Text> }}
              className={styles.logItem}
            />
          );
        })}
    </FlexElement>
  </Page>
);

export default WebhookLogs;
