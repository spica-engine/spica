/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React, { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  useGetWebhookQuery,
  useGetWebhookLogsQuery,
  useDeleteWebhookMutation,
} from "../../store/api/webhookApi";
import Loader from "../../components/atoms/loader/Loader";
import Page from "../../components/organisms/page-layout/Page";
import AddWebhookForm from "../../components/prefabs/navigations/webhook/AddWebhookForm";
import { WebhookDetails } from "./components/WebhookDetails";
import { WebhookLogs } from "./components/WebhookLogs";
import Confirmation from "../../components/molecules/confirmation/Confirmation";
import styles from "./Webhook.module.scss";
import { Button, Drawer, FlexElement, Icon, Text } from "oziko-ui-kit";

const Webhook = () => {
  const { webhookId = "" } = useParams<{ webhookId: string }>();
  const navigate = useNavigate();
  const { data: webhook, isLoading } = useGetWebhookQuery(webhookId, {
    skip: !webhookId,
  });
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
      navigate(-1);
    } finally {
      handleCloseDeleteConfirmation();
    }
  }, [webhook?._id, deleteWebhook, navigate, handleCloseDeleteConfirmation]);

  if (isLoading) {
    return <Loader />;
  }

  if (!webhook) {
    return (
      <Page title="Webhook">
        <div className={styles.empty}>Webhook not found</div>
      </Page>
    );
  }

  return (
    <div className={styles.webhookContainer}>
      <FlexElement
        dimensionX="fill"
        alignment="rightCenter"
        gap={10}
        className={styles.actionButtons}
      >
        <Button color="default" onClick={handleOpenEditDrawer}>
          <Icon name="pencil" />
          Edit
        </Button>
        <Button color="danger" onClick={handleOpenDeleteConfirmation}>
          <Icon name="delete" />
          Delete
        </Button>
      </FlexElement>
      <WebhookDetails webhook={webhook} />
      <WebhookLogs logs={logs} isLoading={isLoadingLogs} />

      <Drawer
        placement="right"
        size={600}
        isOpen={isEditDrawerOpen}
        onClose={handleCloseEditDrawer}
        showCloseButton={false}
      >
        <FlexElement
          dimensionX="fill"
          direction="vertical"
          gap={16}
          alignment="leftTop"
          className={styles.editDrawerContent}
        >
          <Text size="large">Edit Webhook</Text>
          <AddWebhookForm
            key={isEditDrawerOpen ? webhook._id : "closed"}
            onClose={handleCloseEditDrawer}
            initialWebhook={webhook}
          />
        </FlexElement>
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
