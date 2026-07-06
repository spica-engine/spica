/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React, {memo, useCallback, useEffect, useMemo, useState} from "react";
import {Button, Drawer, FlexElement, Icon, Input, NumberInput, Select, StringInput, Text} from "oziko-ui-kit";
import {
  useCreateFunctionMutation,
  useUpdateFunctionMutation,
  useUpdateFunctionIndexMutation,
  useGetFunctionInformationQuery
} from "../../../../store/api/functionApi";
import type {SpicaFunction, Enqueuer, TriggerMap} from "../../../../store/api/functionApi";
import {resolveRenderer, SchemaFieldProvider} from "./schema-fields";
import styles from "./FunctionModal.module.scss";

type FunctionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  functionToEdit?: SpicaFunction;
  onSaved: (fn: SpicaFunction) => void;
};

const buildTriggersMap = (fn: SpicaFunction): TriggerMap => {
  if (!fn.triggers) return {};
  if (Array.isArray(fn.triggers)) {
    return fn.triggers.reduce<TriggerMap>((acc, trigger, i) => {
      const key = trigger.handler ?? (i === 0 ? "default" : `handler_${i}`);
      acc[key] = {type: trigger.type, active: trigger.active ?? true, options: trigger.options ?? {}};
      return acc;
    }, {});
  }
  return {...(fn.triggers as TriggerMap)};
};

const getPrimaryTriggerKey = (map: TriggerMap): string => {
  if (map.default) return "default";
  const firstKey = Object.keys(map)[0];
  return firstKey ?? "default";
};

const getTriggerFromFunction = (
  fn: SpicaFunction
): {key: string; type: string; options: Record<string, any>} => {
  const map = buildTriggersMap(fn);
  const key = getPrimaryTriggerKey(map);
  const trigger = map[key];
  return {key, type: trigger?.type ?? "http", options: trigger?.options ?? {}};
};

const LANGUAGE_OPTIONS = [
  {label: "JavaScript", value: "javascript"},
  {label: "TypeScript", value: "typescript"}
];

const FALLBACK_TRIGGER_TYPE_OPTIONS = [
  {label: "Http", value: "http"},
  {label: "Firehose", value: "firehose"},
  {label: "Database", value: "database"},
  {label: "Scheduler", value: "schedule"},
  {label: "System", value: "system"},
  {label: "Bucket", value: "bucket"}
];

const TRIGGER_EXAMPLES: Record<string, string> = {
  http: `export default function (req, res) {\n\treturn res.status(201).send("Spica is awesome!");\n}`,
  firehose: `export default function ({ socket, pool }, message) {\n\tconsole.log(message.name);\n\tconsole.log(message.data);\n\tconst isAuthorized = false;\n\tif (isAuthorized) {\n\t\tsocket.send("authorization", { state: true });\n\t\tpool.send("connection", { id: socket.id, ip_address: socket.remoteAddress });\n\t} else {\n\t\tsocket.send("authorization", { state: false, error: "Authorization has failed." });\n\t\tsocket.close();\n\t}\n}`,
  database: `export default function (change) {\n\tconsole.log(change.kind + " action has been performed on document with id " + change.documentKey + " of collection " + change.collection);\n\tconsole.log("Document: ", change.document);\n}`,
  schedule: `export default function () {\n\tconsole.log("Scheduled function executed.");\n}`,
  system: `export default function () {\n\tconsole.log("Spica is ready.");\n}`,
  bucket: `export default function (change) {\n\tconsole.log(change.kind + " action has been performed on document with id " + change.documentKey + " of bucket with id " + change.bucket);\n\tconsole.log("Previous document: ", change.previous);\n\tif (change.current) {\n\t\tconsole.log("Current document: ", change.current);\n\t}\n}`
};

const DATABASE_EXAMPLES: Record<string, string> = {
  INSERT: `export default function (change) {\n\tconsole.log(change.kind + " action has been performed on document with id " + change.documentKey + " of collection " + change.collection);\n\tconsole.log("Document: ",change.document);\n}`,
  REPLACE: `export default function (change) {\n\tconsole.log(change.kind + " action has been performed on document with id " + change.documentKey + " of collection " + change.collection);\n\tconsole.log("Document: ", change.document);\n}`,
  UPDATE: `export default function (change) {\n\tconsole.log(change.kind + " action has been performed on document with id " + change.documentKey + " of collection " + change.collection);\n\tconsole.log("Document: ",change.document);\n}`,
  DELETE: `export default function (change) {\n\tconsole.log(change.kind + " action has been performed on document with id " + change.documentKey + " of collection " + change.collection);\n}`
};

const BUCKET_EXAMPLES: Record<string, string> = {
  ALL: `export default function (change) {\n\tconsole.log(change.kind + " action has been performed on document with id " + change.documentKey + " of bucket with id " + change.bucket);\n\tconsole.log("Previous document: ",change.previous);\n\tif (change.current) {\n\t\tconsole.log("Current document: ",change.current)\n\t}\n}`,
  INSERT: `export default function (change) {\n\tconsole.log(change.kind + " action has been performed on document with id " + change.documentKey + " of bucket with id " + change.bucket);\n\tconsole.log("Previous document: ",change.previous);\n\tconsole.log("Current document: ",change.current)\n}`,
  UPDATE: `export default function (change) {\n\tconsole.log(change.kind + " action has been performed on document with id " + change.documentKey + " of bucket with id " + change.bucket);\n\tconsole.log("Previous document: ",change.previous);\n\tconsole.log("Current document: ",change.current)\n}`,
  DELETE: `export default function (change) {\n\tconsole.log(change.kind + " action has been performed on document with id " + change.documentKey + " of bucket with id " + change.bucket);\n\tconsole.log("Previous document: ",change.previous)\n}`
};

const getSchemaDefaults = (properties: Record<string, any>): Record<string, any> => {
  const defaults: Record<string, any> = {};
  for (const [key, schema] of Object.entries(properties)) {
    if (schema.default !== undefined) {
      defaults[key] = schema.default;
    } else if (schema.type === "object" && schema.properties) {
      const nested = getSchemaDefaults(schema.properties);
      if (Object.keys(nested).length > 0) defaults[key] = nested;
    }
  }
  return defaults;
};

const getDefaultTriggerOptions = (enqueuers: Enqueuer[], type: string): Record<string, any> => {
  const enqueuer = enqueuers.find(e => e.description.name === type);
  if (!enqueuer?.options?.properties) return {};
  return getSchemaDefaults(enqueuer.options.properties);
};

const getExampleCode = (type: string, options: Record<string, any>): string => {
  if (type === "database") {
    return options.type
      ? (DATABASE_EXAMPLES[options.type] ?? TRIGGER_EXAMPLES.database)
      : TRIGGER_EXAMPLES.database;
  }
  if (type === "bucket") {
    return options.type
      ? (BUCKET_EXAMPLES[options.type] ?? TRIGGER_EXAMPLES.bucket)
      : TRIGGER_EXAMPLES.bucket;
  }
  return TRIGGER_EXAMPLES[type] ?? TRIGGER_EXAMPLES.http;
};

const FunctionModal = ({isOpen, onClose, functionToEdit, onSaved}: FunctionModalProps) => {
  const isEditMode = !!functionToEdit;
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [language, setLanguage] = useState<string>("javascript");
  const [timeout, setTimeout] = useState(10);
  const [triggerType, setTriggerType] = useState<string>("http");
  const [triggerOptionValues, setTriggerOptionValues] = useState<Record<string, any>>({});
  const [editingTriggerKey, setEditingTriggerKey] = useState("default");
  const [error, setError] = useState("");

  const {data: information} = useGetFunctionInformationQuery();
  const [createFunction, {isLoading: isCreating}] = useCreateFunctionMutation();
  const [updateFunction, {isLoading: isUpdating}] = useUpdateFunctionMutation();
  const [updateIndex] = useUpdateFunctionIndexMutation();

  const isSaving = isCreating || isUpdating;

  const maxTimeout = information?.timeout ?? 120;

  const triggerTypeSelectOptions =
    information?.enqueuers && information.enqueuers.length > 0
      ? information.enqueuers.map(e => ({label: e.description.title, value: e.description.name}))
      : FALLBACK_TRIGGER_TYPE_OPTIONS;

  const selectedEnqueuer = useMemo(
    () => information?.enqueuers?.find(e => e.description.name === triggerType),
    [information, triggerType]
  );

  useEffect(() => {
    if (!isOpen) return;
    if (functionToEdit) {
      setName(functionToEdit.name ?? "");
      setCategory(functionToEdit.category ?? "");
      setLanguage(functionToEdit.language ?? "javascript");
      setTimeout(functionToEdit.timeout ?? 10);
      const trigger = getTriggerFromFunction(functionToEdit);
      setEditingTriggerKey(trigger.key);
      setTriggerType(trigger.type);
      setTriggerOptionValues(trigger.options);
    } else {
      resetForm();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, functionToEdit?._id]);

  useEffect(() => {
    if (isEditMode) return;
    const defaults = getDefaultTriggerOptions(information?.enqueuers ?? [], triggerType);
    // Http schema defaults method to "Get"; the product default is "All" (matches any verb).
    if (triggerType === "http") defaults.method = "All";
    setTriggerOptionValues(defaults);
  }, [triggerType, information, isEditMode]);

  const handleTriggerOptionChange = useCallback((key: string, value: any) => {
    setTriggerOptionValues(prev => ({...prev, [key]: value}));
  }, []);

  const handleNestedOptionChange = useCallback((parentKey: string, childKey: string, value: any) => {
    setTriggerOptionValues(prev => ({
      ...prev,
      [parentKey]: {...(prev[parentKey] ?? {}), [childKey]: value}
    }));
  }, []);

  const handleArrayItemChange = useCallback(
    (key: string, index: number, field: string, value: any) => {
      setTriggerOptionValues(prev => {
        const arr = [...(prev[key] ?? [])];
        arr[index] = {...(arr[index] ?? {}), [field]: value};
        return {...prev, [key]: arr};
      });
    },
    []
  );

  const handleArrayItemAdd = useCallback((key: string) => {
    setTriggerOptionValues(prev => ({
      ...prev,
      [key]: [...(prev[key] ?? []), {}]
    }));
  }, []);

  const handleArrayItemRemove = useCallback((key: string, index: number) => {
    setTriggerOptionValues(prev => ({
      ...prev,
      [key]: (prev[key] ?? []).filter((_: any, i: number) => i !== index)
    }));
  }, []);

  const handleTriggerTypeChange = useCallback((value: string) => {
    setTriggerType(value);
  }, []);

  const resetForm = useCallback(() => {
    setName("");
    setCategory("");
    setLanguage("javascript");
    setTimeout(10);
    setTriggerType("http");
    setTriggerOptionValues({});
    setEditingTriggerKey("default");
    setError("");
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const handleSave = useCallback(async () => {
    setError("");
    const trimmed = name.trim();

    if (!trimmed) {
      setError("Name is required.");
      return;
    }
    if (trimmed.length < 3) {
      setError("Name must be at least 3 characters.");
      return;
    }
    if (trimmed.length > 50) {
      setError("Name cannot exceed 50 characters.");
      return;
    }

    const trimmedCategory = category.trim();

    try {
      if (isEditMode && functionToEdit?._id) {
        const existingTriggers = buildTriggersMap(functionToEdit);
        const editedTrigger = existingTriggers[editingTriggerKey];
        existingTriggers[editingTriggerKey] = {
          type: triggerType,
          active: editedTrigger?.active ?? true,
          options: triggerOptionValues
        };

        const result = await updateFunction({
          id: functionToEdit._id,
          body: {
            name: trimmed,
            language: language as "javascript" | "typescript",
            timeout,
            category: trimmedCategory || undefined,
            triggers: existingTriggers
          }
        }).unwrap();
        onSaved(result);
        onClose();
      } else {
        const result = await createFunction({
          name: trimmed,
          language: language as "javascript" | "typescript",
          timeout,
          category: trimmedCategory || undefined,
          triggers: {
            default: {type: triggerType, active: true, options: triggerOptionValues}
          }
        }).unwrap();

        const exampleCode = getExampleCode(triggerType, triggerOptionValues);
        if (result._id) {
          await updateIndex({id: result._id, index: exampleCode}).unwrap();
        }

        resetForm();
        onSaved(result);
        onClose();
      }
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? (isEditMode ? "Failed to update function." : "Failed to create function."));
    }
  }, [
    name,
    category,
    language,
    timeout,
    triggerType,
    triggerOptionValues,
    editingTriggerKey,
    isEditMode,
    functionToEdit,
    createFunction,
    updateFunction,
    updateIndex,
    resetForm,
    onSaved,
    onClose
  ]);

  const renderField = useCallback(
    (key: string, schema: any, value: any, onChange: (val: any) => void, prefix = "") => {
      const fieldKey = prefix ? `${prefix}.${key}` : key;
      const label = schema.title ?? key;
      const {Component} = resolveRenderer(schema);
      return (
        <Component
          key={fieldKey}
          fieldKey={fieldKey}
          label={label}
          schema={schema}
          value={value}
          onChange={onChange}
        />
      );
    },
    []
  );

  const schemaFieldContextValue = useMemo(
    () => ({
      renderField,
      styles,
      onArrayItemAdd: handleArrayItemAdd,
      onArrayItemRemove: handleArrayItemRemove,
      onArrayItemChange: handleArrayItemChange,
      onNestedChange: handleNestedOptionChange
    }),
    [renderField, handleArrayItemAdd, handleArrayItemRemove, handleArrayItemChange, handleNestedOptionChange]
  );

  const renderTriggerOptionFields = () => {
    const properties = selectedEnqueuer?.options?.properties;
    if (!properties) return null;

    return Object.entries(properties).map(([key, schema]: [string, any]) =>
      renderField(key, schema, triggerOptionValues[key], (val: any) => handleTriggerOptionChange(key, val))
    );
  };

  const baseUrl = (import.meta.env.VITE_BASE_URL as string) || "";

  return (
    <Drawer
      placement="right"
      size={420}
      isOpen={isOpen}
      onClose={handleClose}
      showCloseButton={false}
      scrollableContentClassName={styles.scrollableWrapper}
    >
      <div className={styles.drawerContent}>
        <div className={styles.drawerHeader}>
          <div className={styles.drawerHeaderInfo}>
            <div className={styles.drawerTitle}>{isEditMode ? "Edit Function" : "Add New Function"}</div>
            <div className={styles.drawerSubtitle}>function&nbsp;·&nbsp;{isEditMode ? "edit" : "new"}</div>
          </div>
          <button className={styles.drawerClose} onClick={handleClose}>
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={styles.drawerBody}>
          <StringInput
            label="Name"
            value={name}
            onChange={setName}
          />

          <StringInput
            label="Category"
            value={category}
            onChange={setCategory}
          />

          <FlexElement direction="vertical" alignment="leftCenter" dimensionX="fill" gap={6}>
            <Text size="small" dimensionX="fill" className={styles.fieldLabel}>
              Language
            </Text>
            <Select
              options={LANGUAGE_OPTIONS}
              value={language}
              onChange={v => setLanguage(v as string)}
              dimensionX="fill"
            />
          </FlexElement>

          <div className={styles.timeoutField}>
            <div className={styles.timeoutHeader}>
              <Text size="small" className={styles.fieldLabel}>Timeout</Text>
              <div className={styles.timeoutValue}>
                <span className={styles.timeoutNumber}>{timeout}</span>
                <span className={styles.timeoutUnit}>seconds</span>
              </div>
            </div>
            <input
              type="range"
              className={styles.slider}
              min={1}
              max={maxTimeout}
              step={1}
              value={timeout}
              style={{"--pct": `${((timeout - 1) / (maxTimeout - 1)) * 100}%`} as React.CSSProperties}
              onChange={e => setTimeout(Number(e.target.value))}
            />
            <div className={styles.timeoutRange}>
              <span className={styles.timeoutRangeLabel}>1s</span>
              <span className={styles.timeoutRangeLabel}>{maxTimeout}s</span>
            </div>
          </div>

          <div className={styles.triggerHeading}>Trigger</div>

          <FlexElement direction="vertical" alignment="leftCenter" dimensionX="fill" gap={6}>
            <Text size="small" dimensionX="fill" className={styles.fieldLabel}>
              Type
            </Text>
            <Select
              options={triggerTypeSelectOptions}
              value={triggerType}
              onChange={v => handleTriggerTypeChange(v as string)}
              dimensionX="fill"
            />
          </FlexElement>

          <SchemaFieldProvider value={schemaFieldContextValue}>
            {renderTriggerOptionFields()}
          </SchemaFieldProvider>

          {triggerType === "http" && triggerOptionValues.path && (
            <Text size="small" className={styles.httpUrlPreview}>
              {baseUrl}/fn-execute{triggerOptionValues.path}
            </Text>
          )}

          {error && (
            <Text variant="danger" className={styles.errorText}>
              {error}
            </Text>
          )}
        </div>

        <div className={styles.drawerFooter}>
          <Button
            onClick={handleSave}
            variant="solid"
            color="primary"
            disabled={isSaving || !name.trim() || !triggerType}
            loading={isSaving}
          >
            <Icon name={isEditMode ? "check" : "plus"} />
            {isEditMode ? "Save" : "Create"}
          </Button>
          <Button variant="text" onClick={handleClose} disabled={isSaving}>
            <Icon name="close" />
            Cancel
          </Button>
        </div>
      </div>
    </Drawer>
  );
};

export default memo(FunctionModal);

