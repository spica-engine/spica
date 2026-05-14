/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useParams, useNavigate} from "react-router-dom";
import {Button, FlexElement, Icon, Text} from "oziko-ui-kit";
import {
  functionApi,
  useGetFunctionQuery,
  useGetFunctionIndexQuery,
  useUpdateFunctionIndexMutation,
  useUpdateFunctionMutation,
  useDeleteFunctionMutation,
  useGetFunctionInformationQuery,
  useInjectEnvVarMutation,
  useEjectEnvVarMutation,
  useInjectSecretMutation,
  useEjectSecretMutation,
} from "../../store/api/functionApi";
import {useGetFunctionLogsQuery, useClearFunctionLogsMutation} from "../../store/api/functionApi";
import type {FunctionLog} from "../../store/api/functionApi";
import type {FunctionTrigger, ResolvedEnvVar, ResolvedSecret} from "../../store/api/functionApi";
import {useAppDispatch} from "../../store/hook";
import Loader from "../../components/atoms/loader/Loader";
import Confirmation from "../../components/molecules/confirmation/Confirmation";
import CodeEditor from "./components/CodeEditor";
import ImportedFunctionPanel from "./components/ImportedFunctionPanel";
import TriggerPanel from "./components/TriggerPanel";
import DependencyPanel from "./components/DependencyPanel";
import EnvironmentPanel from "./components/EnvironmentPanel";
import FunctionLogList from "../function-log/FunctionLogList";
import FunctionLogFilter from "../function-log/FunctionLogFilter";
import ConfigurationDialog from "./components/ConfigurationDialog";
import {LOG_LEVEL_LABELS as LEVEL_LABELS} from "../../utils/functionLogLevels";
import styles from "./FunctionPage.module.scss";

const IMPORT_REGEX = /^import\s+\*\s+as\s+(\w+)\s+from\s+["']\.\.\/\.\.\/([^/]+)\/\.build["'];?\s*$/gm;

const FunctionPage = () => {
  const {functionId = ""} = useParams<{functionId: string}>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const {data: fn, isLoading: isFnLoading} = useGetFunctionQuery(functionId, {
    skip: !functionId,
  });
  const {data: indexData, isLoading: isIndexLoading} = useGetFunctionIndexQuery(functionId, {
    skip: !functionId,
  });
  const {data: information} = useGetFunctionInformationQuery();
  const [updateIndex, {isLoading: isIndexSaving}] = useUpdateFunctionIndexMutation();
  const [updateFunction] = useUpdateFunctionMutation();
  const [deleteFunction, {isLoading: isDeleting, error: deleteError}] = useDeleteFunctionMutation();
  const [injectEnvVar] = useInjectEnvVarMutation();
  const [ejectEnvVar] = useEjectEnvVarMutation();
  const [injectSecret] = useInjectSecretMutation();
  const [ejectSecret] = useEjectSecretMutation();
  const [clearFunctionLogs, {isLoading: isClearingLogs}] = useClearFunctionLogsMutation();

  const [code, setCode] = useState("");
  const [lastSavedCode, setLastSavedCode] = useState("");
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showLogs, setShowLogs] = useState(false);
  const [logHeight, setLogHeight] = useState(300);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [localTriggers, setLocalTriggers] = useState<FunctionTrigger[]>([]);
  const [localEnvVars, setLocalEnvVars] = useState<ResolvedEnvVar[]>([]);
  const [localSecrets, setLocalSecrets] = useState<ResolvedSecret[]>([]);
  const [isSidebarSaving, setIsSidebarSaving] = useState(false);
  const [logSearchQuery, setLogSearchQuery] = useState("");
  const [logDateRange, setLogDateRange] = useState(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const begin = new Date();
    begin.setHours(0, 0, 0, 0);
    return {begin, end};
  });
  const [logSelectedLevels, setLogSelectedLevels] = useState<number[]>([]);

  const isResizingRef = useRef(false);

  const {data: fnLogs = [], refetch: refetchLogs, isFetching: isLogsFetching} = useGetFunctionLogsQuery(
    {
      functions: [functionId],
      begin: logDateRange.begin.toISOString(),
      end: logDateRange.end.toISOString(),
      limit: 100,
      sort: {_id: -1},
      levels: logSelectedLevels.length > 0 ? logSelectedLevels : undefined,
    },
    {skip: !functionId || !showLogs}
  );

  const logFunctionNames = useMemo<Record<string, string>>(
    () => (fn ? {[functionId]: fn.name} : {}),
    [fn, functionId]
  );

  const logHandlerNames = useMemo<Record<string, string>>(() => {
    if (!fn) return {};
    const triggers = fn.triggers;
    let handler = "default";
    if (Array.isArray(triggers) && triggers.length > 0) {
      handler = triggers[0].handler ?? "default";
    } else if (triggers && typeof triggers === "object") {
      const firstKey = Object.keys(triggers)[0];
      if (firstKey) handler = firstKey;
    }
    return {[functionId]: handler};
  }, [fn, functionId]);

  const filteredLogs = useMemo<FunctionLog[]>(() => {
    if (!logSearchQuery.trim()) return fnLogs;
    const q = logSearchQuery.toLowerCase();
    return fnLogs.filter(log => {
      const fnName = (logFunctionNames[log.function] ?? log.function).toLowerCase();
      const handler = (logHandlerNames[log.function] ?? "default").toLowerCase();
      const content = log.content.toLowerCase();
      const severity = (LEVEL_LABELS[log.level] ?? "").toLowerCase();
      const ts = Number.parseInt(log._id.substring(0, 8), 16) * 1000;
      const timestamp = new Date(ts).toLocaleString().toLowerCase();
      return (
        fnName.includes(q) ||
        handler.includes(q) ||
        content.includes(q) ||
        severity.includes(q) ||
        timestamp.includes(q)
      );
    });
  }, [fnLogs, logSearchQuery, logFunctionNames, logHandlerNames]);

  const serverTriggers = useMemo<FunctionTrigger[]>(() => {
    if (!fn) return [];
    if (Array.isArray(fn.triggers)) return fn.triggers;
    if (fn.triggers) {
      return Object.entries(fn.triggers as Record<string, any>).map(([handler, desc]) => ({
        handler,
        type: desc.type,
        active: desc.active,
        options: desc.options ?? {},
      }));
    }
    return [];
  }, [fn]);

  useEffect(() => {
    if (indexData?.index != null) {
      setCode(indexData.index);
      setLastSavedCode(indexData.index);
    }
  }, [indexData]);

  useEffect(() => {
    if (fn) {
      setLocalTriggers(serverTriggers);
      setLocalEnvVars(fn.env_vars ?? []);
      setLocalSecrets(fn.secrets ?? []);
    }
  }, [fn, serverTriggers]);

  const handlers = useMemo(() => {
    const re = /^\s*export +(async +)?function\s+(\w+)\s*\(|^\s*export +(default)\s+(async +)?function\s*\(|^\s*export +(let|var|const)\s*(\w+)\s*=\s*(function\s*)?\(/gm;
    const result: string[] = [];
    let groups;
    while ((groups = re.exec(code)) !== null) {
      if (groups.index === re.lastIndex) re.lastIndex++;
      const names = groups
        .slice(1)
        .filter(Boolean)
        .filter(n => !["async", "const", "var", "let", "function"].includes(n.trim()));
      result.push(...names);
    }
    return result;
  }, [code]);

  const importedFunctionIds = useMemo(() => {
    const ids: string[] = [];
    const re = new RegExp(IMPORT_REGEX.source, IMPORT_REGEX.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(code)) !== null) ids.push(m[2]);
    return ids;
  }, [code]);

  const [extraLibs, setExtraLibs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (importedFunctionIds.length === 0) {
      setExtraLibs({});
      return;
    }

    const subscriptions = importedFunctionIds.map(id =>
      dispatch(functionApi.endpoints.getFunctionIndex.initiate(id))
    );

    Promise.all(subscriptions.map(s => s.unwrap())).then(results => {
      const libs: Record<string, string> = {};
      importedFunctionIds.forEach((id, i) => {
        if (results[i]?.index) libs[id] = results[i].index;
      });
      setExtraLibs(libs);
    }).catch(() => {});

    return () => {
      subscriptions.forEach(s => s.unsubscribe());
    };
  }, [importedFunctionIds, dispatch]);

  const hasUnsavedChanges = code !== lastSavedCode;
  const hasSidebarChanges =
    JSON.stringify(localTriggers) !== JSON.stringify(serverTriggers) ||
    JSON.stringify(localEnvVars) !== JSON.stringify(fn?.env_vars ?? []) ||
    JSON.stringify(localSecrets) !== JSON.stringify(fn?.secrets ?? []);

  const handleSaveIndex = useCallback(async () => {
    if (!functionId || isIndexSaving) return;
    try {
      await updateIndex({id: functionId, index: code}).unwrap();
      setLastSavedCode(code);
      setLastSaveTime(new Date());
    } catch {
      // RTK Query handles the error
    }
  }, [functionId, code, isIndexSaving, updateIndex]);

  const handleSaveSidebar = useCallback(async () => {
    if (!fn?._id || isSidebarSaving) return;
    setIsSidebarSaving(true);
    try {
      const triggersChanged = JSON.stringify(localTriggers) !== JSON.stringify(serverTriggers);

      if (triggersChanged) {
        const triggersMap = localTriggers.reduce<Record<string, any>>((acc, trigger, i) => {
          const key = trigger.handler ?? (i === 0 ? "default" : `handler_${i}`);
          acc[key] = {type: trigger.type, active: trigger.active ?? true, options: trigger.options};
          return acc;
        }, {});

        await updateFunction({
          id: fn._id,
          body: {name: fn.name, language: fn.language, timeout: fn.timeout, triggers: triggersMap},
        }).unwrap();
      }

      const serverEnvVarIds = new Set((fn.env_vars ?? []).map(v => v._id));
      const localEnvVarIds = new Set(localEnvVars.map(v => v._id));

      for (const v of localEnvVars) {
        if (!serverEnvVarIds.has(v._id)) {
          await injectEnvVar({functionId: fn._id, envVarId: v._id}).unwrap();
        }
      }
      for (const v of fn.env_vars ?? []) {
        if (!localEnvVarIds.has(v._id)) {
          await ejectEnvVar({functionId: fn._id, envVarId: v._id}).unwrap();
        }
      }

      const serverSecretIds = new Set((fn.secrets ?? []).map(s => s._id));
      const localSecretIds = new Set(localSecrets.map(s => s._id));

      for (const s of localSecrets) {
        if (!serverSecretIds.has(s._id)) {
          await injectSecret({functionId: fn._id, secretId: s._id}).unwrap();
        }
      }
      for (const s of fn.secrets ?? []) {
        if (!localSecretIds.has(s._id)) {
          await ejectSecret({functionId: fn._id, secretId: s._id}).unwrap();
        }
      }

      if (hasUnsavedChanges) {
        await updateIndex({id: fn._id, index: code}).unwrap();
        setLastSavedCode(code);
        setLastSaveTime(new Date());
      }
    } finally {
      setIsSidebarSaving(false);
    }
  }, [fn, localTriggers, serverTriggers, localEnvVars, localSecrets, isSidebarSaving, updateFunction, injectEnvVar, ejectEnvVar, injectSecret, ejectSecret, hasUnsavedChanges, code, updateIndex]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!functionId) return;
    try {
      await deleteFunction(functionId).unwrap();
      navigate("/dashboard");
    } finally {
      setIsDeleteOpen(false);
    }
  }, [functionId, deleteFunction, navigate]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizingRef.current) return;
    const newHeight = window.innerHeight - e.clientY;
    if (newHeight >= 42 && newHeight <= window.innerHeight * 0.6) {
      setLogHeight(newHeight);
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isResizingRef.current = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  }, [handleMouseMove]);

  const handleResizeStart = useCallback(() => {
    isResizingRef.current = true;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [handleMouseMove, handleMouseUp]);

  const handleLogFilterApply = useCallback(
    (begin: Date, end: Date, _functions: string[], levels: number[]) => {
      setLogDateRange({begin, end});
      setLogSelectedLevels(levels);
    },
    []
  );

  const handleLogReset = useCallback(() => {
    setLogSearchQuery("");
    setLogSelectedLevels([]);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const begin = new Date();
    begin.setHours(0, 0, 0, 0);
    setLogDateRange({begin, end});
  }, []);

  const handleClearLogs = useCallback(async () => {
    if (!functionId) return;
    await clearFunctionLogs({
      functionId,
      begin: logDateRange.begin.toISOString(),
      end: logDateRange.end.toISOString(),
    });
    refetchLogs();
  }, [functionId, clearFunctionLogs, logDateRange, refetchLogs]);

  const isLogFilterApplied = (() => {
    if (logSearchQuery.trim() !== "" || logSelectedLevels.length > 0) return true;
    const today = new Date();
    return (
      logDateRange.begin.toDateString() !== today.toDateString() ||
      logDateRange.begin.getHours() !== 0 ||
      logDateRange.begin.getMinutes() !== 0 ||
      logDateRange.end.toDateString() !== today.toDateString() ||
      logDateRange.end.getHours() !== 23 ||
      logDateRange.end.getMinutes() !== 59
    );
  })();

  const toggleLogs = useCallback(() => setShowLogs(prev => !prev), []);
  const toggleSidebar = useCallback(() => setShowSidebar(prev => !prev), []);

  if (isFnLoading || isIndexLoading) {
    return (
      <div className={styles.loadingContainer}>
        <Loader />
      </div>
    );
  }

  if (!fn) {
    return <div className={styles.emptyState}>Function not found</div>;
  }

  return (
    <div className={styles.container}>
      <div className={`${styles.codeArea} ${!showSidebar ? styles.codeAreaExpanded : ""}`}>
        {/* Toolbar */}
        <div className={styles.codeToolbar}>
          <div className={styles.toolbarTitle}>
            <Icon name="function" size="md" />
            <Text size="medium">{fn.name}</Text>
          </div>
          <div className={styles.toolbarSpacer} />
          <div className={styles.toolbarActions}>
            <Button variant="icon" color="transparent" onClick={() => setIsEditOpen(true)}>
              <Icon name="pencil" size="sm" />
            </Button>
            <Button variant="icon" color="transparent" onClick={handleSaveIndex} disabled={isIndexSaving || !hasUnsavedChanges}>
              <Icon name="save" size="sm" />
            </Button>
            {lastSaveTime && (
              <span className={styles.saveStatus}>
                Saved: {lastSaveTime.toLocaleTimeString()}
              </span>
            )}
            {isIndexSaving && <span className={styles.saveStatus}>Saving...</span>}
            <Button variant="icon" color="transparent" onClick={toggleSidebar}>
              <Icon name={showSidebar ? "chevronRight" : "chevronLeft"} size="sm" />
            </Button>
          </div>
        </div>

        {/* Editor */}
        <div className={styles.editorWrapper}>
          <CodeEditor
            value={code}
            language={fn.language ?? "javascript"}
            onChange={setCode}
            onSave={handleSaveIndex}
            functionId={functionId}
            extraLibs={extraLibs}
          />
        </div>

        {/* Resize handle */}
        {showLogs && (
          <hr className={styles.resizeHandle} onMouseDown={handleResizeStart} />
        )}

        {/* Log panel */}
        <div
          className={styles.footerBar}
          style={showLogs ? {height: logHeight} : undefined}
        >
          <button className={styles.footerToggle} onClick={toggleLogs}>
            <Icon name="chevronDown" size="sm" />
            Logs
          </button>
          {showLogs && (
            <div className={styles.footerLogWrapper}>
              <FunctionLogList
                logs={filteredLogs}
                searchQuery={logSearchQuery}
                onSearchChange={setLogSearchQuery}
                functionNames={logFunctionNames}
                handlerNames={logHandlerNames}
                onRefresh={refetchLogs}
                onReset={handleLogReset}
                isFilterApplied={isLogFilterApplied}
                isRefreshing={isLogsFetching}
                toolbarActions={
                  <Button variant="solid" color="danger" onClick={handleClearLogs} loading={isClearingLogs} disabled={isClearingLogs || fnLogs.length === 0}>
                    <Icon name="delete" size="sm" />
                    Clear
                  </Button>
                }
                filterActions={
                  <FunctionLogFilter
                    begin={logDateRange.begin}
                    end={logDateRange.end}
                    selectedLevels={logSelectedLevels}
                    onApply={handleLogFilterApply}
                    hideFunctionFilter
                  />
                }
              />
            </div>
          )}
        </div>
      </div>

      {/* Right sidebar */}
      <div className={`${styles.sidebar} ${!showSidebar ? styles.sidebarHidden : ""}`}>
        <div className={styles.sidebarContent}>
        <ImportedFunctionPanel code={code} onCodeChange={setCode} currentFunctionId={functionId} />
        <TriggerPanel
          triggers={localTriggers}
          enqueuers={information?.enqueuers ?? []}
          handlers={handlers}
          onChange={setLocalTriggers}
        />
        <DependencyPanel functionId={functionId} />
        <EnvironmentPanel
          envVars={localEnvVars}
          secrets={localSecrets}
          onEnvVarsChange={setLocalEnvVars}
          onSecretsChange={setLocalSecrets}
        />
        </div>
        <FlexElement className={styles.saveButtonContainer} direction="vertical" dimensionX="fill">
        <Button
            fullWidth
            variant="solid"
            color="primary"
            onClick={handleSaveSidebar}
            disabled={(!hasSidebarChanges && !hasUnsavedChanges) || isSidebarSaving}
          >
            <Icon name="save" size="sm" />
            {isSidebarSaving ? "Saving..." : "Save"}
          </Button>
        </FlexElement>
      
      </div>

      {/* Edit drawer */}
      <ConfigurationDialog
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        initialFunction={fn}
        onSaved={() => {}}
      />

      {/* Delete confirmation */}
      {isDeleteOpen && (
        <Confirmation
          title="DELETE FUNCTION"
          description={
            <>
              <span>This action will permanently delete this function.</span>
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
          onCancel={() => setIsDeleteOpen(false)}
          loading={isDeleting}
          error={
            deleteError
              ? (deleteError as {data?: {message?: string}; message?: string})?.data?.message ??
                (deleteError as Error)?.message ??
                "Delete failed"
              : undefined
          }
        />
      )}
    </div>
  );
};

export default FunctionPage;
