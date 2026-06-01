/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import {useCallback, useEffect, useMemo, useState} from "react";
import {useParams, useNavigate} from "react-router-dom";
import type {KeyboardEvent} from "react";
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
import type {FunctionTrigger, ResolvedEnvVar, ResolvedSecret} from "../../store/api/functionApi";
import {useAppDispatch} from "../../store/hook";
import Loader from "../../components/atoms/loader/Loader";
import FunctionModal from "../../components/prefabs/navigations/function/FunctionModal";
import FunctionDeleteConfirmation from "./components/FunctionDeleteConfirmation";
import FunctionEditorLayout from "./components/FunctionEditorLayout";
import FunctionEditorPanel from "./components/FunctionEditorPanel";
import FunctionHeader from "./components/FunctionHeader";
import FunctionLogFooter from "./components/FunctionLogFooter";
import FunctionSidebar from "./components/FunctionSidebar";
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

  const [code, setCode] = useState("");
  const [lastSavedCode, setLastSavedCode] = useState("");
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showLogs, setShowLogs] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [localTriggers, setLocalTriggers] = useState<FunctionTrigger[]>([]);
  const [localEnvVars, setLocalEnvVars] = useState<ResolvedEnvVar[]>([]);
  const [localSecrets, setLocalSecrets] = useState<ResolvedSecret[]>([]);
  const [isSidebarSaving, setIsSidebarSaving] = useState(false);
  const [isNameEditing, setIsNameEditing] = useState(false);
  const [editingName, setEditingName] = useState("");

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

  const handleNameEditStart = useCallback(() => {
    if (!fn) return;
    setEditingName(fn.name);
    setIsNameEditing(true);
  }, [fn]);

  const handleNameEditSave = useCallback(async () => {
    if (!fn?._id || !editingName.trim()) {
      setIsNameEditing(false);
      return;
    }
    const newName = editingName.trim();
    if (newName !== fn.name) {
      try {
        await updateFunction({
          id: fn._id,
          body: {name: newName, language: fn.language, timeout: fn.timeout, triggers: fn.triggers as any},
        }).unwrap();
      } catch {
        // revert on error
      }
    }
    setIsNameEditing(false);
  }, [fn, editingName, updateFunction]);

  const handleNameEditKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") handleNameEditSave();
      if (e.key === "Escape") setIsNameEditing(false);
    },
    [handleNameEditSave]
  );

  const toggleLogs = useCallback(() => setShowLogs(prev => !prev), []);
  const toggleSidebar = useCallback(() => setShowSidebar(prev => !prev), []);

  const defaultLogHandlerName = useMemo(() => {
    const triggers = fn?.triggers;
    if (Array.isArray(triggers) && triggers.length > 0) {
      return triggers[0].handler ?? "default";
    }
    if (triggers && typeof triggers === "object") {
      const firstKey = Object.keys(triggers)[0];
      if (firstKey) {
        return firstKey;
      }
    }
    return "default";
  }, [fn]);

  const editorLanguage = fn?.language === "typescript" ? "typescript" : "javascript";

  const deleteErrorMessage = deleteError
    ? (deleteError as {data?: {message?: string}; message?: string})?.data?.message ??
      (deleteError as Error)?.message ??
      "Delete failed"
    : undefined;

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
    <>
      <FunctionEditorLayout
        showSidebar={showSidebar}
        header={
          <FunctionHeader
            functionName={fn.name}
            isNameEditing={isNameEditing}
            editingName={editingName}
            onEditStart={handleNameEditStart}
            onEditingNameChange={setEditingName}
            onEditSave={handleNameEditSave}
            onEditKeyDown={handleNameEditKeyDown}
            onOpenConfiguration={() => setIsEditOpen(true)}
            onSaveCode={handleSaveIndex}
            onToggleSidebar={toggleSidebar}
            showSidebar={showSidebar}
            hasUnsavedChanges={hasUnsavedChanges}
            isSaving={isIndexSaving}
            lastSaveTime={lastSaveTime}
          />
        }
        editor={
          <FunctionEditorPanel
            code={code}
            language={editorLanguage}
            onChange={setCode}
            onSave={handleSaveIndex}
            functionId={functionId}
            extraLibs={extraLibs}
          />
        }
        footer={
          <FunctionLogFooter
            functionId={functionId}
            functionName={fn.name}
            defaultHandlerName={defaultLogHandlerName}
            isOpen={showLogs}
            onToggle={toggleLogs}
          />
        }
        sidebar={
          <FunctionSidebar
            showSidebar={showSidebar}
            code={code}
            functionId={functionId}
            triggers={localTriggers}
            enqueuers={information?.enqueuers ?? []}
            handlers={handlers}
            envVars={localEnvVars}
            secrets={localSecrets}
            hasChanges={hasSidebarChanges}
            isSaving={isSidebarSaving}
            hasUnsavedCodeChanges={hasUnsavedChanges}
            onCodeChange={setCode}
            onTriggersChange={setLocalTriggers}
            onEnvVarsChange={setLocalEnvVars}
            onSecretsChange={setLocalSecrets}
            onSave={handleSaveSidebar}
          />
        }
      />

      <FunctionModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        functionToEdit={fn}
        onSaved={() => setIsEditOpen(false)}
      />

      <FunctionDeleteConfirmation
        isOpen={isDeleteOpen}
        loading={isDeleting}
        error={deleteErrorMessage}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setIsDeleteOpen(false)}
      />
    </>
  );
};

export default FunctionPage;
