/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React, { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import styles from "../Navigation.module.scss";
import webhookStyles from "./WebHook.module.scss";
import { Button, Drawer, FlexElement, FluidContainer, Icon, Popover, Text } from "oziko-ui-kit";
import { useGetWebhooksQuery } from "../../../../store/api/webhookApi";
import AddWebhookForm from "./AddWebhookForm";
import { InfoRow } from "./InfoRow";

const WebHook = () => {
  const { data, isLoading } = useGetWebhooksQuery();
  const webhooks = data?.data ?? [];
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleOpenDrawer = useCallback(() => setIsDrawerOpen(true), []);
  const handleCloseDrawer = useCallback(() => setIsDrawerOpen(false), []);

  return (
    <div className={styles.container}>
      <FlexElement
        dimensionX="fill"
        dimensionY="fill"
        alignment="leftCenter"
        className={styles.header}
      >
        Webhooks
      </FlexElement>

      {(() => {
        if (isLoading) {
          return (
            <Text size="small" className={styles.defaultNavigationItem}>
              Loading...
            </Text>
          );
        }
        if (webhooks.length === 0) {
          return (
            <Text size="small" className={styles.defaultNavigationItem}>
              No webhooks
            </Text>
          );
        }
        return webhooks.map((webhook) => (
          <Link
            key={webhook._id ?? webhook.url}
            to={webhook._id ? `/webhook/${webhook._id}` : "#"}
            className={`${styles.defaultNavigationItem} ${webhookStyles.webhookLink}`}
          >
            <FluidContainer
              dimensionX="fill"
              dimensionY={36}
              mode="fill"
              prefix={{
                children: <Icon name="webhook" size="md" />,
              }}
              root={{
                children: (
                  <Text size="medium" dimensionX="fill">
                    {webhook.title || webhook.url}
                  </Text>
                ),
                alignment: "leftCenter",
              }}
              suffix={{
                children: (
                  <Popover
                    trigger="hover"
                    content={
                      <FlexElement direction="vertical" gap={8} alignment="leftTop">
                        <InfoRow
                          label="ID"
                          value={webhook._id}
                          labelWidth={80}
                          valueClassName={webhookStyles.infoItem}
                          labelClassName={webhookStyles.infoItem}
                        />
                        <InfoRow
                          label="Trigger"
                          value={`${webhook.trigger?.options?.collection}/${webhook.trigger?.options?.type || "-"}`}
                          labelWidth={80}
                          valueClassName={webhookStyles.infoItem}
                          labelClassName={webhookStyles.infoItem}
                        />
                        <InfoRow
                          label="Running"
                          value={webhook.trigger?.active ? "Yes" : "No"}
                          labelWidth={80}
                          valueClassName={`${webhookStyles.infoItem} ${webhook.trigger?.active ? webhookStyles.active : webhookStyles.inactive}`}
                          labelClassName={webhookStyles.infoItem}
                        />
                      </FlexElement>
                    }
                  >
                    <Icon name="dotsVertical" />
                  </Popover>
                ),
              }}
            />
          </Link>
        ));
      })()}

      <FlexElement dimensionX="fill" alignment="center" className={webhookStyles.addWebhookButtonContainer}>
        <Button  variant="text" onClick={handleOpenDrawer} className={webhookStyles.addWebhookButton}>
          <Icon name="plus" /> Add Webhook
        </Button>
      </FlexElement>

      <Drawer
        placement="right"
        size={600}
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        showCloseButton={false}
      >
        <FlexElement
          dimensionX="fill"
          direction="vertical"
          gap={16}
          alignment="leftTop"
          className={styles.webhookDrawerContent}
        >
          <Text size="large">Add Webhook</Text>
          <AddWebhookForm
            key={isDrawerOpen ? "create" : "closed"}
            onClose={handleCloseDrawer}
          />
        </FlexElement>
      </Drawer>
    </div>
  );
};

export default WebHook;
