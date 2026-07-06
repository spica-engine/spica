/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React, {useCallback, useEffect, useMemo, useState} from "react";
import {useNavigate, useParams} from "react-router-dom";
import {Button, Chip, Drawer, FlexElement, Icon, Text, type TableColumn} from "oziko-ui-kit";
import SpicaTable from "../../components/organisms/table/Table";
import SearchBar from "../../components/atoms/search-bar/SearchBar";
import FunctionTriggersList from "../../components/organisms/function-triggers-list/FunctionTriggersList";
import FunctionWorkflowGraph from "../../components/organisms/function-workflow-graph/FunctionWorkflowGraph";
import {useGetEnvVarsQuery, useDeleteEnvVarMutation} from "../../store/api/envVarApi";
import type {EnvVar} from "../../store/api/envVarApi";
import {useGetSecretsQuery, useDeleteSecretMutation} from "../../store/api/secretApi";
import type {Secret} from "../../store/api/secretApi";
import {useGetFunctionsQuery} from "../../store/api/functionApi";
import type {SpicaFunction} from "../../store/api/functionApi";
import {useGetBucketsQuery} from "../../store/api/bucketApi";
import {useThemeMode} from "../../hooks/useThemeMode";
import {normalizeTriggers} from "../../utils/functionTriggers";
import FunctionVariableForm from "./FunctionVariableForm";
import EntryForm from "../secrets-and-variables/components/EntryForm";
import DeleteConfirmation from "../secrets-and-variables/components/DeleteConfirmation";
import styles from "./FunctionVariablesPage.module.scss";

const SECRET_MASK = "••••••••••••";

type TabType = "variables" | "secrets" | "triggers" | "workflow";
type DeleteTarget = {type: "variable"; item: EnvVar} | {type: "secret"; item: Secret};

const TAB_ORDER: TabType[] = ["variables", "secrets", "triggers", "workflow"];
const DEFAULT_TAB: TabType = "variables";

const FunctionVariablesPage = () => {
  const {data: envVarsResponse, isLoading: isEnvLoading} = useGetEnvVarsQuery({limit: 200, skip: 0});
  const {data: secretsResponse, isLoading: isSecretsLoading} = useGetSecretsQuery({limit: 200, skip: 0});
  const {
    data: functionsResponse,
    isLoading: isFunctionsLoading,
    isError: isFunctionsError,
    refetch: refetchFunctions
  } = useGetFunctionsQuery();
  const {data: bucketsResponse, isLoading: isBucketsLoading, isError: isBucketsError} =
    useGetBucketsQuery();
  const [deleteEnvVar, {isLoading: isDeletingVar}] = useDeleteEnvVarMutation();
  const [deleteSecret, {isLoading: isDeletingSecret}] = useDeleteSecretMutation();

  const themeMode = useThemeMode();

  const navigate = useNavigate();
  const {tab} = useParams<{tab?: string}>();
  const activeTab: TabType = TAB_ORDER.includes(tab as TabType) ? (tab as TabType) : DEFAULT_TAB;

  // Redirect unknown tab slugs to the default so deep links can't render a blank view.
  useEffect(() => {
    if (tab && !TAB_ORDER.includes(tab as TabType)) {
      navigate(`/function-variables/${DEFAULT_TAB}`, {replace: true});
    }
  }, [tab, navigate]);

  const handleSelectTab = useCallback(
    (next: TabType) => navigate(`/function-variables/${next}`),
    [navigate]
  );

  const [isVariableDrawerOpen, setIsVariableDrawerOpen] = useState(false);
  const [selectedVariable, setSelectedVariable] = useState<EnvVar | null>(null);
  const [isSecretDrawerOpen, setIsSecretDrawerOpen] = useState(false);
  const [selectedSecret, setSelectedSecret] = useState<Secret | null>(null);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const allEnvVars = useMemo(() => envVarsResponse?.data ?? [], [envVarsResponse]);
  const allSecrets = useMemo(() => secretsResponse?.data ?? [], [secretsResponse]);

  const functionList: SpicaFunction[] = useMemo(
    () => (Array.isArray(functionsResponse) ? functionsResponse : functionsResponse?.data ?? []),
    [functionsResponse]
  );

  const buckets = useMemo(() => bucketsResponse ?? [], [bucketsResponse]);

  const triggerCount = useMemo(
    () => functionList.reduce((total, fn) => total + normalizeTriggers(fn).length, 0),
    [functionList]
  );

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const envVars = useMemo(
    () => (normalizedSearch ? allEnvVars.filter(ev => ev.key.toLowerCase().includes(normalizedSearch)) : allEnvVars),
    [allEnvVars, normalizedSearch]
  );

  const secrets = useMemo(
    () => (normalizedSearch ? allSecrets.filter(s => s.key.toLowerCase().includes(normalizedSearch)) : allSecrets),
    [allSecrets, normalizedSearch]
  );

  // Map each variable to the functions that inject it, so the scope column can render chips.
  const assignedFunctionsMap = useMemo<Record<string, SpicaFunction[]>>(() => {
    const map: Record<string, SpicaFunction[]> = {};
    allEnvVars.forEach(ev => {
      map[ev._id] = [];
    });
    functionList.forEach(fn => {
      (fn.env_vars ?? []).forEach(ev => {
        if (map[ev._id]) map[ev._id].push(fn);
      });
    });
    return map;
  }, [allEnvVars, functionList]);

  const toggleReveal = useCallback((id: string) => {
    setRevealedIds(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleOpenCreateVariable = useCallback(() => {
    setSelectedVariable(null);
    setIsVariableDrawerOpen(true);
  }, []);

  const handleOpenEditVariable = useCallback((envVar: EnvVar) => {
    setSelectedVariable(envVar);
    setIsVariableDrawerOpen(true);
  }, []);

  const handleCloseVariableDrawer = useCallback(() => {
    setIsVariableDrawerOpen(false);
    setSelectedVariable(null);
  }, []);

  const handleOpenCreateSecret = useCallback(() => {
    setSelectedSecret(null);
    setIsSecretDrawerOpen(true);
  }, []);

  const handleOpenEditSecret = useCallback((secret: Secret) => {
    setSelectedSecret(secret);
    setIsSecretDrawerOpen(true);
  }, []);

  const handleCloseSecretDrawer = useCallback(() => {
    setIsSecretDrawerOpen(false);
    setSelectedSecret(null);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === "variable") {
        await deleteEnvVar(deleteTarget.item._id).unwrap();
      } else {
        await deleteSecret(deleteTarget.item._id).unwrap();
      }
      setDeleteTarget(null);
    } catch {
      // Error surfaced by RTK Query
    }
  }, [deleteTarget, deleteEnvVar, deleteSecret]);

  const handleCancelDelete = useCallback(() => setDeleteTarget(null), []);

  const variableColumns: TableColumn<EnvVar>[] = useMemo(
    () => [
      {
        header: <FlexElement>Key</FlexElement>,
        key: "key",
        renderCell: ({row}) => (
          <span className={styles.keyCell}>
            <Icon name="key" size="sm" className={styles.keyIcon} />
            {row.key}
          </span>
        )
      },
      {
        header: <FlexElement>Value</FlexElement>,
        key: "value",
        renderCell: ({row}) => {
          const revealed = revealedIds.has(row._id);
          return (
            <FlexElement direction="horizontal" gap={6} alignment="leftCenter">
              <span className={styles.valueCell} title={revealed ? row.value : undefined}>
                {revealed ? row.value : SECRET_MASK}
              </span>
              <Button
                variant="icon"
                color="default"
                className={styles.revealButton}
                onClick={() => toggleReveal(row._id)}
                title={revealed ? "Hide value" : "Reveal value"}
              >
                <Icon name={revealed ? "eyeOff" : "eye"} size="sm" />
              </Button>
            </FlexElement>
          );
        }
      },
      {
        header: <FlexElement>Assigned Functions</FlexElement>,
        key: "functions",
        renderCell: ({row}) => {
          const fns = assignedFunctionsMap[row._id] ?? [];
          if (fns.length === 0) return <span className={styles.emptyFunctions}>—</span>;
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
              onClick={() => handleOpenEditVariable(row)}
              title="Edit variable"
            >
              <Icon name="pencil" />
            </Button>
            <Button
              variant="icon"
              color="danger"
              className={styles.actionButton}
              onClick={() => setDeleteTarget({type: "variable", item: row})}
              title="Delete variable"
            >
              <Icon name="delete" />
            </Button>
          </FlexElement>
        )
      }
    ],
    [assignedFunctionsMap, handleOpenEditVariable, revealedIds, toggleReveal]
  );

  const secretColumns: TableColumn<Secret>[] = useMemo(
    () => [
      {
        header: <FlexElement>Key</FlexElement>,
        key: "key",
        renderCell: ({row}) => (
          <span className={styles.keyCell}>
            <Icon name="lock" size="sm" className={styles.keyIcon} />
            {row.key}
            <span className={styles.secretBadge}>SECRET</span>
          </span>
        )
      },
      {
        header: <FlexElement>Value</FlexElement>,
        key: "value",
        renderCell: () => <span className={styles.valueMasked}>{SECRET_MASK}</span>
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
              onClick={() => handleOpenEditSecret(row)}
              title="Edit secret"
            >
              <Icon name="pencil" />
            </Button>
            <Button
              variant="icon"
              color="danger"
              className={styles.actionButton}
              onClick={() => setDeleteTarget({type: "secret", item: row})}
              title="Delete secret"
            >
              <Icon name="delete" />
            </Button>
          </FlexElement>
        )
      }
    ],
    [handleOpenEditSecret]
  );

  const assignedFunctionIds = useMemo(
    () => (selectedVariable ? (assignedFunctionsMap[selectedVariable._id] ?? []).map(fn => fn._id!) : []),
    [assignedFunctionsMap, selectedVariable]
  );

  const showSearch = activeTab === "variables" || activeTab === "secrets";

  const renderTab = useCallback(
    (tab: TabType, label: string, count?: number) => (
      <button
        role="tab"
        type="button"
        aria-selected={activeTab === tab}
        className={activeTab === tab ? styles.tabActive : styles.tab}
        onClick={() => handleSelectTab(tab)}
      >
        {label}
        {count !== undefined && <span className={styles.tabCount}>{count}</span>}
      </button>
    ),
    [activeTab, handleSelectTab]
  );

  return (
    <>
      <div className={styles.page}>
        <div className={styles.pageHead}>
          <div className={styles.pageSectionLabel}>Functions</div>
          <p className={styles.pageDesc}>
            Manage function environment variables and secrets, review every trigger, and explore how functions and
            buckets connect in the workflow graph.
          </p>
        </div>

        <div className={styles.tabsRow}>
          <div role="tablist" className={styles.tabs}>
            {renderTab("variables", "Variables", envVars.length)}
            {renderTab("secrets", "Secrets", secrets.length)}
            {renderTab("triggers", "Triggers", triggerCount)}
            {renderTab("workflow", "Workflow")}
          </div>
          <div className={styles.tabsActions}>
            {activeTab === "variables" && (
              <Button variant="solid" color="primary" onClick={handleOpenCreateVariable}>
                <Icon name="plus" /> New Variable
              </Button>
            )}
            {activeTab === "secrets" && (
              <Button variant="solid" color="default" onClick={handleOpenCreateSecret}>
                <Icon name="lock" /> New Secret
              </Button>
            )}
          </div>
        </div>

        {showSearch && (
          <div className={styles.toolbar}>
            <SearchBar
              loading={false}
              inputProps={{
                placeholder: activeTab === "variables" ? "Search variables…" : "Search secrets…",
                value: searchQuery,
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)
              }}
            />
          </div>
        )}

        <div className={styles.tabContent}>
          {activeTab === "variables" && (
            <div className={styles.tableArea}>
              <SpicaTable
                data={envVars}
                columns={variableColumns}
                isLoading={isEnvLoading}
                skeletonRowCount={4}
                emptyState={{
                  title: searchQuery ? "No variables found" : "No variables yet",
                  description: searchQuery
                    ? `No variables match "${searchQuery}".`
                    : "Create a variable to inject non-sensitive configuration into your functions."
                }}
              />
            </div>
          )}

          {activeTab === "secrets" && (
            <div className={styles.tableArea}>
              <SpicaTable
                data={secrets}
                columns={secretColumns}
                isLoading={isSecretsLoading}
                skeletonRowCount={4}
                emptyState={{
                  title: searchQuery ? "No secrets found" : "No secrets yet",
                  description: searchQuery
                    ? `No secrets match "${searchQuery}".`
                    : "Create a secret to store encrypted, sensitive values."
                }}
              />
            </div>
          )}

          {activeTab === "triggers" && (
            <FunctionTriggersList
              functions={functionList}
              buckets={buckets}
              isLoading={isFunctionsLoading}
            />
          )}

          {activeTab === "workflow" && (
            <div className={styles.graphPane}>
              <FunctionWorkflowGraph
                functions={functionList}
                buckets={buckets}
                colorMode={themeMode}
                isLoading={isFunctionsLoading || isBucketsLoading}
                isError={isFunctionsError || isBucketsError}
                onRetry={refetchFunctions}
              />
            </div>
          )}
        </div>
      </div>

      <Drawer
        placement="right"
        size={500}
        isOpen={isVariableDrawerOpen}
        onClose={handleCloseVariableDrawer}
        showCloseButton={false}
      >
        <FunctionVariableForm
          isOpen={isVariableDrawerOpen}
          selectedVariable={selectedVariable}
          functionList={functionList}
          assignedFunctionIds={assignedFunctionIds}
          onClose={handleCloseVariableDrawer}
        />
      </Drawer>

      <Drawer
        placement="right"
        size={480}
        isOpen={isSecretDrawerOpen}
        onClose={handleCloseSecretDrawer}
        showCloseButton={false}
      >
        <EntryForm
          isOpen={isSecretDrawerOpen}
          defaultType="secret"
          selectedSecret={selectedSecret}
          onClose={handleCloseSecretDrawer}
        />
      </Drawer>

      {deleteTarget && (
        <DeleteConfirmation
          itemType={deleteTarget.type}
          itemKey={deleteTarget.item.key}
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
          isLoading={deleteTarget.type === "variable" ? isDeletingVar : isDeletingSecret}
        />
      )}
    </>
  );
};

export default FunctionVariablesPage;
