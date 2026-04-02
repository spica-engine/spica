import React, { useCallback, useMemo, useState } from "react";
import { Button, Drawer, FlexElement, Icon, Text, type TableColumn } from "oziko-ui-kit";
import {
  useGetSecretsQuery,
  useDeleteSecretMutation,
} from "../../../store/api/secretApi";
import type { Secret } from "../../../store/api/secretApi";
import SpicaTable from "../../../components/organisms/table/Table";
import SecretForm from "./SecretForm";
import DeleteConfirmation from "./DeleteConfirmation";
import styles from "../SecretsAndVariables.module.scss";

const SecretsTab = () => {
  const { data: response, isLoading } = useGetSecretsQuery({ limit: 100, skip: 0 });
  const [deleteSecret, { isLoading: isDeleting }] = useDeleteSecretMutation();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedSecret, setSelectedSecret] = useState<Secret | null>(null);
  const [secretToDelete, setSecretToDelete] = useState<Secret | null>(null);

  const handleOpenDrawer = useCallback(() => {
    setSelectedSecret(null);
    setIsDrawerOpen(true);
  }, []);

  const handleEditSecret = useCallback((secret: Secret) => {
    setSelectedSecret(secret);
    setIsDrawerOpen(true);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    setSelectedSecret(null);
  }, []);

  const handleDeleteClick = useCallback((e: React.MouseEvent, secret: Secret) => {
    e.stopPropagation();
    setSecretToDelete(secret);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!secretToDelete) return;
    try {
      await deleteSecret(secretToDelete._id).unwrap();
      setSecretToDelete(null);
    } catch {
      // Error handled by RTK Query
    }
  }, [secretToDelete, deleteSecret]);

  const handleCancelDelete = useCallback(() => setSecretToDelete(null), []);

  const secrets = response?.data ?? [];

  const columns: TableColumn<Secret>[] = useMemo(
    () => [
      {
        header: <FlexElement>Name</FlexElement>,
        key: "key",
        renderCell: ({ row }) => (
          <span className={styles.keyCell}>{row.key}</span>
        ),
      },
      {
        header: <FlexElement>Last updated</FlexElement>,
        key: "updated",
        renderCell: () => <span>—</span>,
      },
      {
        header: (
          <FlexElement dimensionX="fill" alignment="rightCenter" direction="horizontal">
            Actions
          </FlexElement>
        ),
        key: "actions",
        width: "120px",
        minWidth: "120px",
        renderCell: ({ row }) => (
          <FlexElement dimensionX="fill" alignment="rightCenter" direction="horizontal">
            <Button
              variant="icon"
              color="default"
              className={styles.actionButton}
              onClick={() => handleEditSecret(row)}
              title="Edit secret"
            >
              <Icon name="pencil" />
            </Button>
            <Button
              variant="icon"
              color="danger"
              className={styles.actionButton}
              onClick={(e) => handleDeleteClick(e, row)}
              title="Delete secret"
            >
              <Icon name="delete" />
            </Button>
          </FlexElement>
        ),
      },
    ],
    [handleEditSecret, handleDeleteClick]
  );

  return (
    <FlexElement dimensionX="fill" dimensionY="fill" alignment="rightBottom" direction="vertical" gap={10}>

        <Button variant="solid" color="primary" onClick={handleOpenDrawer}>
          <Icon name="plus" /> New repository secret
        </Button>

    <FlexElement dimensionX="fill" direction="vertical" gap={10}>

          <SpicaTable
        data={secrets}
        columns={columns}
        isLoading={isLoading}
        skeletonRowCount={5}
      />

      {!isLoading && secrets.length === 0 && (
        <div className={styles.emptyState}>
          <Text>There are no secrets for this repository.</Text>
        </div>
      )}
    </FlexElement>

      <Drawer
        placement="right"
        size={600}
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        showCloseButton={false}
      >
        <SecretForm
          isOpen={isDrawerOpen}
          selectedSecret={selectedSecret}
          onClose={handleCloseDrawer}
        />
      </Drawer>

      {secretToDelete && (
        <DeleteConfirmation
          itemType="secret"
          itemKey={secretToDelete.key}
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
          isLoading={isDeleting}
        />
      )}
    </FlexElement>
  );
};

export default SecretsTab;
