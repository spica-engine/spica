/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React, { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  useGetWebhooksQuery,
  useGetWebhookQuery,
  useGetWebhookLogsQuery,
  useDeleteWebhookMutation,
} from "../../store/api/webhookApi";
import Loader from "../../components/atoms/loader/Loader";
import AddWebhookForm from "../../components/prefabs/navigations/webhook/AddWebhookForm";
import { WebhookDetails } from "./components/WebhookDetails";
import { WebhookLogs } from "./components/WebhookLogs";
import Confirmation from "../../components/molecules/confirmation/Confirmation";
import styles from "./Webhook.module.scss";
import { Button, Drawer, Icon } from "oziko-ui-kit";

const Webhook = () => {
  const { webhookId = "" } = useParams<{ webhookId: string }>();
  const navigate = useNavigate();
  const { data: webhook, isLoading } = useGetWebhookQuery(webhookId, {
    skip: !webhookId,
  });
  const { data: allWebhooksData } = useGetWebhooksQuery();
  const allWebhooks = allWebhooksData?.data ?? [];
  const { data: logs = [], isLoading: isLoadingLogs } = useGetWebhookLogsQuery(
    { webhooks: webhookId ? [webhookId] : undefined, limit: 20 },
    { skip: !webhookId }
  );
  const [deleteWebhook, { isLoading: isDeleting, error: deleteError }] =
    useDeleteWebhookMutation();
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false);

  const handleOpenEditDrawer = useCallback(() => setIsEditDrawerOpen(true), []);
  const handleCloseEditDrawer = useCallback(() => setIsEditDrawerOpen(false), []);

  const handleOpenDeleteConfirmation = useCallback(
    () => setIsDeleteConfirmationOpen(true),
    []
  );
  const handleCloseDeleteConfirmation = useCallback(
    () => setIsDeleteConfirmationOpen(false),
    []
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!webhook?._id) return;
    try {
      await deleteWebhook(webhook._id).unwrap();
      const remaining = allWebhooks.filter((w) => w._id !== webhook._id);
      const lastWebhook = remaining[remaining.length - 1];
      if (lastWebhook?._id) {
        navigate(`/webhook/${lastWebhook._id}`);
      } else {
        navigate("/webhook");
      }
    } finally {
      handleCloseDeleteConfirmation();
    }
  }, [webhook, deleteWebhook, navigate, allWebhooks, handleCloseDeleteConfirmation]);

  if (isLoading) {
    return <Loader />;
  }

  if (!webhook) {
    return (
      <div className={styles.webhookContainer}>
        <div className={styles.empty}>Webhook not found</div>
      </div>
    );
  }

  return (
    <div className={styles.webhookContainer}>
      <div className={styles.actionBar}>
        <Button color="default" onClick={handleOpenEditDrawer}>
          <Icon name="pencil" />
          Edit
        </Button>
        <Button color="danger" onClick={handleOpenDeleteConfirmation}>
          <Icon name="delete" />
          Delete
        </Button>
      </div>

      <WebhookDetails webhook={webhook} />
      <WebhookLogs logs={logs} isLoading={isLoadingLogs} />

      <Drawer
        placement="right"
        size={600}
        isOpen={isEditDrawerOpen}
        onClose={handleCloseEditDrawer}
        showCloseButton={false}
        scrollableContentClassName={styles.drawerScrollable}
      >
        <div className={styles.drawerContent}>
          <div className={styles.drawerHeader}>
            <div className={styles.drawerHeaderInfo}>
              <div className={styles.drawerTitle}>Edit Webhook</div>
              <div className={styles.drawerSubtitle}>
                {webhook.title}&nbsp;&middot;&nbsp;edit webhook
              </div>
            </div>
            <button className={styles.drawerClose} onClick={handleCloseEditDrawer}>
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className={styles.drawerBody}>
            <AddWebhookForm
              key={isEditDrawerOpen ? webhook._id : "closed"}
              onClose={handleCloseEditDrawer}
              initialWebhook={webhook}
            />
          </div>
        </div>
      </Drawer>

      {isDeleteConfirmationOpen ? (
        <Confirmation
          title="DELETE WEBHOOK"
          description={
            <>
              <span>This action will permanently delete this webhook.</span>
              <span>
                Please type <strong>agree</strong> to confirm deletion.
              </span>
            </>
          }
          inputPlaceholder="Type Here"
          confirmLabel={
            <>
              <Icon name="delete" />
              Delete
            </>
          }
          cancelLabel={
            <>
              <Icon name="close" />
              Cancel
            </>
          }
          confirmCondition={(input) => input === "agree"}
          showInput
          onConfirm={handleDeleteConfirm}
          onCancel={handleCloseDeleteConfirmation}
          loading={isDeleting}
          error={
            deleteError
              ? (deleteError as { data?: { message?: string }; message?: string })
                  ?.data?.message ??
                (deleteError as Error)?.message ??
                "Delete failed"
              : undefined
          }
        />
      ) : null}
    </div>
  );
};

export default Webhook;
