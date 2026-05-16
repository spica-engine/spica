import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Drawer, FlexElement, Icon, type TableColumn } from "oziko-ui-kit";
import {
  useGetSecretsQuery,
  useDeleteSecretMutation,
} from "../../../store/api/secretApi";
import type { Secret } from "../../../store/api/secretApi";
import SpicaTable from "../../../components/organisms/table/Table";
import SearchBar from "../../../components/atoms/search-bar/SearchBar";
import EntryForm from "./EntryForm";
import DeleteConfirmation from "./DeleteConfirmation";
import styles from "../SecretsAndVariables.module.scss";

type SecretsTabProps = {
  isNewOpen?: boolean;
  onNewClose?: () => void;
  onCountChange?: (count: number) => void;
};

const SecretsTab = ({ isNewOpen, onNewClose, onCountChange }: SecretsTabProps) => {
  const { data: response, isLoading } = useGetSecretsQuery({ limit: 100, skip: 0 });
  const [deleteSecret, { isLoading: isDeleting }] = useDeleteSecretMutation();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedSecret, setSelectedSecret] = useState<Secret | null>(null);
  const [secretToDelete, setSecretToDelete] = useState<Secret | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const secrets = response?.data ?? [];

  const filteredSecrets = useMemo(
    () =>
      searchQuery.trim()
        ? secrets.filter((s) =>
            s.key.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : secrets,
    [secrets, searchQuery]
  );

  useEffect(() => {
    onCountChange?.(secrets.length);
  }, [secrets.length, onCountChange]);

  useEffect(() => {
    if (isNewOpen) {
      setSelectedSecret(null);
      setIsDrawerOpen(true);
      onNewClose?.();
    }
  }, [isNewOpen, onNewClose]);

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

  const columns: TableColumn<Secret>[] = useMemo(
    () => [
      {
        header: <FlexElement>Name</FlexElement>,
        key: "key",
        renderCell: ({ row }) => (
          <span className={styles.keyCell}>
            {row.key}
            <span className={styles.badgeSecret}>SECRET</span>
          </span>
        ),
      },
      {
        header: <FlexElement>Value</FlexElement>,
        key: "value",
        renderCell: () => <span className={styles.valueMasked}>••••••••••••</span>,
      },
      {
        header: <FlexElement>Last updated</FlexElement>,
        key: "updated",
        renderCell: () => <span className={styles.dateCell}>—</span>,
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
    <FlexElement dimensionX="fill" direction="vertical" gap={0}>
      <div className={styles.toolbar}>
        <SearchBar
          className={styles.searchBox}
          inputProps={{
            placeholder: "Search…",
            value: searchQuery,
            onChange: (e) => setSearchQuery(e.target.value),
          }}
        />
        <span className={styles.entryCount}>{filteredSecrets.length} entries</span>
      </div>

      <div className={styles.tableArea}>
        <SpicaTable
          data={filteredSecrets}
          columns={columns}
          isLoading={isLoading}
          skeletonRowCount={5}
          emptyState={{
            title: searchQuery ? "No secrets found" : "No secrets yet",
            description: searchQuery
              ? `No secrets match "${searchQuery}".`
              : "Add your first secret to store sensitive data securely.",
          }}
        />
      </div>

      <Drawer
        placement="right"
        size={480}
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        showCloseButton={false}
      >
        <EntryForm
          isOpen={isDrawerOpen}
          defaultType="secret"
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

