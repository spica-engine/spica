/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React, { memo, useState, useCallback, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import styles from "../Navigation.module.scss";
import webhookStyles from "./WebHook.module.scss";
import { Drawer, FlexElement, Icon, Popover } from "oziko-ui-kit";
import { useGetWebhooksQuery, useUpdateWebhookMutation, type Webhook } from "../../../../store/api/webhookApi";
import AddWebhookForm from "./AddWebhookForm";
import { InfoRow } from "./InfoRow";

interface WebhookItemProps {
  webhook: Webhook;
  isActive: boolean;
}

const WebhookItem = memo(({ webhook, isActive }: WebhookItemProps) => {
  const [updateWebhook, { isLoading: isUpdating }] = useUpdateWebhookMutation();
  const isRunning = webhook.trigger?.active ?? false;

  const handleToggleRunning = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!webhook._id || isUpdating) return;
      await updateWebhook({
        id: webhook._id,
        body: {
          title: webhook.title,
          url: webhook.url,
          body: webhook.body,
          trigger: { ...webhook.trigger, active: !isRunning },
        },
      });
    },
    [webhook._id, webhook.trigger, isRunning, isUpdating, updateWebhook]
  );

  return (
    <Link
      to={webhook._id ? `/webhook/${webhook._id}` : "#"}
      className={`${webhookStyles.webhookItem} ${isActive ? webhookStyles.webhookItemActive : ""}`}
    >
      <Icon name="webhook" size="sm" className={webhookStyles.webhookIcon} />
      <span className={webhookStyles.webhookName}>
        {webhook.title || webhook.url}
      </span>
      <div
        className={`${webhookStyles.statusDot} ${
          isRunning ? webhookStyles.statusDotActive : webhookStyles.statusDotInactive
        }`}
      />
      <Popover
          trigger="hover"
          content={
            <FlexElement direction="vertical" gap={8} alignment="leftTop">
              <InfoRow
                label="ID"
                value={webhook._id}
                labelWidth={80}
                valueClassName={webhookStyles.popoverValue}
                labelClassName={webhookStyles.popoverLabel}
              />
              <InfoRow
                label="Trigger"
                value={`${webhook.trigger?.options?.collection ?? "-"}/${webhook.trigger?.options?.type ?? "-"}`}
                labelWidth={80}
                valueClassName={webhookStyles.popoverValue}
                labelClassName={webhookStyles.popoverLabel}
              />
              <div className={webhookStyles.popoverRow}>
                <span className={webhookStyles.popoverLabel} style={{ minWidth: 80 }}>Running</span>
                <button
                  type="button"
                  className={`${webhookStyles.toggleSwitch} ${isRunning ? webhookStyles.toggleSwitchOn : ""}`}
                  onClick={handleToggleRunning}
                  disabled={isUpdating}
                />
              </div>
            </FlexElement>
          }
        >
        <div className={webhookStyles.dotsMenu}>
            <Icon name="dotsVertical" size="sm" />
          </div>
        </Popover>
    </Link>
  );
});

const WebHook = () => {
  const { data, isLoading } = useGetWebhooksQuery();
  const webhooks = data?.data ?? [];
  const location = useLocation();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const activeWebhookId = useMemo(() => {
    const match = location.pathname.match(/^\/webhook\/(.+)/);
    return match ? match[1] : null;
  }, [location.pathname]);

  const handleOpenDrawer = useCallback(() => setIsDrawerOpen(true), []);
  const handleCloseDrawer = useCallback(() => setIsDrawerOpen(false), []);

  return (
    <div className={styles.container}>
      <div className={styles.sidebarHead}>
        <div className={styles.sidebarTopRow}>
          <span className={styles.sidebarLabel}>Webhooks</span>
        </div>
      </div>

      <div className={webhookStyles.webhooksItemContainer}>
        {isLoading && (
          <span className={webhookStyles.stateText}>Loading…</span>
        )}
        {!isLoading && webhooks.length === 0 && (
          <span className={webhookStyles.stateText}>No webhooks</span>
        )}
        {!isLoading &&
          webhooks.map((webhook) => (
            <WebhookItem
              key={webhook._id ?? webhook.url}
              webhook={webhook}
              isActive={activeWebhookId === webhook._id}
            />
          ))}
      </div>

      <div className={webhookStyles.addWebhookBtnWrapper}>
        <button className={webhookStyles.addWebhookBtn} onClick={handleOpenDrawer} type="button">
          <Icon name="plus" size="sm" />
          New Webhook
        </button>
      </div>

      <Drawer
        placement="right"
        size={600}
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        showCloseButton={false}
        scrollableContentClassName={webhookStyles.drawerScrollable}
      >
        <div className={webhookStyles.drawerContent}>
          <div className={webhookStyles.drawerHeader}>
            <div className={webhookStyles.drawerHeaderInfo}>
              <div className={webhookStyles.drawerTitle}>Add Webhook</div>
              <div className={webhookStyles.drawerSubtitle}>create new webhook</div>
            </div>
            <button className={webhookStyles.drawerClose} onClick={handleCloseDrawer} type="button">
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className={webhookStyles.drawerBody}>
            <AddWebhookForm
              key={isDrawerOpen ? "create" : "closed"}
              onClose={handleCloseDrawer}
            />
          </div>
        </div>
      </Drawer>
    </div>
  );
};

export default memo(WebHook);
