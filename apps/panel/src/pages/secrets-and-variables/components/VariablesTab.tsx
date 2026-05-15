import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Drawer, FlexElement, Icon, type TableColumn } from "oziko-ui-kit";
import {
  useGetEnvVarsQuery,
  useDeleteEnvVarMutation,
} from "../../../store/api/envVarApi";
import type { EnvVar } from "../../../store/api/envVarApi";
import SpicaTable from "../../../components/organisms/table/Table";
import SearchBar from "../../../components/atoms/search-bar/SearchBar";
import EntryForm from "./EntryForm";
import DeleteConfirmation from "./DeleteConfirmation";
import styles from "../SecretsAndVariables.module.scss";

type VariablesTabProps = {
  isNewOpen?: boolean;
  onNewClose?: () => void;
  onCountChange?: (count: number) => void;
};

const VariablesTab = ({ isNewOpen, onNewClose, onCountChange }: VariablesTabProps) => {
  const { data: response, isLoading } = useGetEnvVarsQuery({ limit: 100, skip: 0 });
  const [deleteEnvVar, { isLoading: isDeleting }] = useDeleteEnvVarMutation();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedVariable, setSelectedVariable] = useState<EnvVar | null>(null);
  const [variableToDelete, setVariableToDelete] = useState<EnvVar | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const envVars = response?.data ?? [];

  const filteredVars = useMemo(
    () =>
      searchQuery.trim()
        ? envVars.filter((v) =>
            v.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
            v.value.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : envVars,
    [envVars, searchQuery]
  );

  useEffect(() => {
    onCountChange?.(envVars.length);
  }, [envVars.length, onCountChange]);

  useEffect(() => {
    if (isNewOpen) {
      setSelectedVariable(null);
      setIsDrawerOpen(true);
      onNewClose?.();
    }
  }, [isNewOpen, onNewClose]);

  const handleEditVariable = useCallback((envVar: EnvVar) => {
    setSelectedVariable(envVar);
    setIsDrawerOpen(true);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    setSelectedVariable(null);
  }, []);

  const handleDeleteClick = useCallback((e: React.MouseEvent, envVar: EnvVar) => {
    e.stopPropagation();
    setVariableToDelete(envVar);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!variableToDelete) return;
    try {
      await deleteEnvVar(variableToDelete._id).unwrap();
      setVariableToDelete(null);
    } catch {
      // Error handled by RTK Query
    }
  }, [variableToDelete, deleteEnvVar]);

  const handleCancelDelete = useCallback(() => setVariableToDelete(null), []);

  const columns: TableColumn<EnvVar>[] = useMemo(
    () => [
      {
        header: <FlexElement>Name</FlexElement>,
        key: "key",
        renderCell: ({ row }) => (
          <span className={styles.keyCell}>
            {row.key}
            <span className={styles.badgeVar}>VAR</span>
          </span>
        ),
      },
      {
        header: <FlexElement>Value</FlexElement>,
        key: "value",
        renderCell: ({ row }) => (
          <span className={styles.valueCell} title={row.value}>{row.value}</span>
        ),
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
              onClick={() => handleEditVariable(row)}
              title="Edit variable"
            >
              <Icon name="pencil" />
            </Button>
            <Button
              variant="icon"
              color="danger"
              className={styles.actionButton}
              onClick={(e) => handleDeleteClick(e, row)}
              title="Delete variable"
            >
              <Icon name="delete" />
            </Button>
          </FlexElement>
        ),
      },
    ],
    [handleEditVariable, handleDeleteClick]
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
        <span className={styles.entryCount}>{filteredVars.length} entries</span>
      </div>

      <div className={styles.tableArea}>
        <SpicaTable
          data={filteredVars}
          columns={columns}
          isLoading={isLoading}
          skeletonRowCount={5}
          emptyState={{
            title: searchQuery ? "No variables found" : "No variables yet",
            description: searchQuery
              ? `No variables match "${searchQuery}".`
              : "Add your first variable to store non-sensitive configuration.",
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
          defaultType="variable"
          selectedVariable={selectedVariable}
          onClose={handleCloseDrawer}
        />
      </Drawer>

      {variableToDelete && (
        <DeleteConfirmation
          itemType="variable"
          itemKey={variableToDelete.key}
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
          isLoading={isDeleting}
        />
      )}
    </FlexElement>
  );
};

export default VariablesTab;

