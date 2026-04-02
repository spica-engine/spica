import React, { useCallback, useMemo, useState } from "react";
import { Button, Drawer, FlexElement, Icon, Text, type TableColumn } from "oziko-ui-kit";
import {
  useGetEnvVarsQuery,
  useDeleteEnvVarMutation,
} from "../../../store/api/envVarApi";
import type { EnvVar } from "../../../store/api/envVarApi";
import SpicaTable from "../../../components/organisms/table/Table";
import VariableForm from "./VariableForm";
import DeleteConfirmation from "./DeleteConfirmation";
import styles from "../SecretsAndVariables.module.scss";

const VariablesTab = () => {
  const { data: response, isLoading } = useGetEnvVarsQuery({ limit: 100, skip: 0 });
  const [deleteEnvVar, { isLoading: isDeleting }] = useDeleteEnvVarMutation();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedVariable, setSelectedVariable] = useState<EnvVar | null>(null);
  const [variableToDelete, setVariableToDelete] = useState<EnvVar | null>(null);

  const handleOpenDrawer = useCallback(() => {
    setSelectedVariable(null);
    setIsDrawerOpen(true);
  }, []);

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

  const envVars = response?.data ?? [];

  const columns: TableColumn<EnvVar>[] = useMemo(
    () => [
      {
        header: <FlexElement>Name</FlexElement>,
        key: "key",
        renderCell: ({ row }) => (
          <span className={styles.keyCell}>{row.key}</span>
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
    <FlexElement dimensionX="fill" alignment="rightBottom" direction="vertical" gap={10}>

        <Button variant="solid" color="primary" onClick={handleOpenDrawer}>
          <Icon name="plus" /> New repository variable
        </Button>

    <FlexElement alignment="center" dimensionX="fill" direction="vertical">
          <SpicaTable
        data={envVars}
        columns={columns}
        isLoading={isLoading}
        skeletonRowCount={5}
      />

      {!isLoading && envVars.length === 0 && (
        <div className={styles.emptyState}>
          <Text>There are no variables for this repository.</Text>
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
        <VariableForm
          isOpen={isDrawerOpen}
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
