/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React, {useCallback, useMemo, useState} from "react";
import {Button, Chip, Drawer, FlexElement, Icon, Text, type TableColumn} from "oziko-ui-kit";
import Page from "../../components/organisms/page-layout/Page";
import SpicaTable from "../../components/organisms/table/Table";
import {useGetEnvVarsQuery, useDeleteEnvVarMutation} from "../../store/api/envVarApi";
import type {EnvVar} from "../../store/api/envVarApi";
import {useGetFunctionsQuery} from "../../store/api/functionApi";
import type {SpicaFunction} from "../../store/api/functionApi";
import FunctionVariableForm from "../function-variables/FunctionVariableForm";
import styles from "./FunctionVariablesPage.module.scss";

const FunctionVariablesPage = () => {
  const {data: envVarsResponse, isLoading: isEnvLoading} = useGetEnvVarsQuery({limit: 200, skip: 0});
  const {data: functionsResponse} = useGetFunctionsQuery();
  const [deleteEnvVar, {isLoading: isDeleting}] = useDeleteEnvVarMutation();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedVariable, setSelectedVariable] = useState<EnvVar | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const envVars = envVarsResponse?.data ?? [];
  const functionList: SpicaFunction[] = useMemo(
    () => (Array.isArray(functionsResponse) ? functionsResponse : functionsResponse?.data ?? []),
    [functionsResponse]
  );

  /**
   * For each env var, collect which functions have it injected.
   * SpicaFunction.env_vars is an array of ResolvedEnvVar with _id.
   */
  const assignedFunctionsMap = useMemo<Record<string, SpicaFunction[]>>(() => {
    const map: Record<string, SpicaFunction[]> = {};
    envVars.forEach(ev => {
      map[ev._id] = [];
    });
    functionList.forEach(fn => {
      (fn.env_vars ?? []).forEach(ev => {
        if (map[ev._id]) {
          map[ev._id].push(fn);
        }
      });
    });
    return map;
  }, [envVars, functionList]);

  const handleOpenCreate = useCallback(() => {
    setSelectedVariable(null);
    setIsDrawerOpen(true);
  }, []);

  const handleOpenEdit = useCallback((envVar: EnvVar) => {
    setSelectedVariable(envVar);
    setIsDrawerOpen(true);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    setSelectedVariable(null);
  }, []);

  const handleDeleteClick = useCallback(
    async (e: React.MouseEvent, envVar: EnvVar) => {
      e.stopPropagation();
      setDeletingId(envVar._id);
      try {
        await deleteEnvVar(envVar._id).unwrap();
      } finally {
        setDeletingId(null);
      }
    },
    [deleteEnvVar]
  );

  const columns: TableColumn<EnvVar>[] = useMemo(
    () => [
      {
        header: <FlexElement>Key</FlexElement>,
        key: "key",
        renderCell: ({row}) => <span className={styles.keyCell}>{row.key}</span>
      },
      {
        header: <FlexElement>Value</FlexElement>,
        key: "value",
        renderCell: ({row}) => (
          <span className={styles.valueCell} title={row.value}>
            {row.value}
          </span>
        )
      },
      {
        header: <FlexElement>Assigned Functions</FlexElement>,
        key: "functions",
        renderCell: ({row}) => {
          const fns = assignedFunctionsMap[row._id] ?? [];
          if (fns.length === 0) {
            return <span className={styles.emptyFunctions}>—</span>;
          }
          return (
            <FlexElement direction="horizontal" gap={4} className={styles.chipList}>
              {fns.map(fn => (
                <Chip key={fn._id} label={fn.name} className={styles.functionChip} />
              ))}
            </FlexElement>
          );
        }
      },
      {
        header: (
          <FlexElement dimensionX="fill" alignment="rightCenter">
            Actions
          </FlexElement>
        ),
        key: "actions",
        width: "100px",
        minWidth: "100px",
        renderCell: ({row}) => (
          <FlexElement dimensionX="fill" alignment="rightCenter" direction="horizontal" gap={4}>
            <Button
              variant="icon"
              color="default"
              className={styles.actionButton}
              onClick={() => handleOpenEdit(row)}
              title="Edit variable"
            >
              <Icon name="pencil" />
            </Button>
            <Button
              variant="icon"
              color="danger"
              className={styles.actionButton}
              onClick={e => handleDeleteClick(e, row)}
              loading={isDeleting && deletingId === row._id}
              title="Delete variable"
            >
              <Icon name="delete" />
            </Button>
          </FlexElement>
        )
      }
    ],
    [assignedFunctionsMap, handleOpenEdit, handleDeleteClick, isDeleting, deletingId]
  );

  return (
   <>
        <FlexElement dimensionX="fill" direction="vertical" gap={16} className={styles.container}>
        <FlexElement dimensionX="fill" alignment="rightCenter" direction="horizontal">
          <Text className={styles.resultCount}>{envVars.length} Results</Text>
          <Button variant="solid" color="primary" onClick={handleOpenCreate}>
            <Icon name="plus" /> New Variable
          </Button>
        </FlexElement>

        <SpicaTable
          data={envVars}
          columns={columns}
          isLoading={isEnvLoading}
          skeletonRowCount={5}
        />

        {!isEnvLoading && envVars.length === 0 && (
          <FlexElement dimensionX="fill" alignment="center" className={styles.emptyState}>
            <Text>No variables yet. Create the first one.</Text>
          </FlexElement>
        )}
      </FlexElement>

      <Drawer
        placement="right"
        size={500}
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        showCloseButton={false}
      >
        <FunctionVariableForm
          isOpen={isDrawerOpen}
          selectedVariable={selectedVariable}
          functionList={functionList}
          assignedFunctionIds={(selectedVariable ? assignedFunctionsMap[selectedVariable._id] ?? [] : []).map(
            fn => fn._id!
          )}
          onClose={handleCloseDrawer}
        />
      </Drawer>
   </>
  );
};

export default FunctionVariablesPage;
