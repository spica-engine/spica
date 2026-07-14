/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React, {memo, useCallback, useEffect, useState} from "react";
import {Button, Drawer, FlexElement, Icon, NumberInput, Select, StringInput, Text} from "oziko-ui-kit";
import {
  useCreateFunctionMutation,
  useUpdateFunctionMutation,
  useUpdateFunctionIndexMutation,
  useGetFunctionInformationQuery
} from "../../../../store/api/functionApi";
import type {SpicaFunction, TriggerMap} from "../../../../store/api/functionApi";
import styles from "./FunctionModal.module.scss";

type FunctionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  functionToEdit?: SpicaFunction;
  onSaved: (fn: SpicaFunction) => void;
};

const WARM_POOL_MAX = 2;

const LANGUAGE_OPTIONS = [
  {label: "JavaScript", value: "javascript"},
  {label: "TypeScript", value: "typescript"}
];

const TRIGGER_EXAMPLES: Record<string, string> = {
  http: `export default function (req, res) {\n\treturn res.status(201).send("Spica is awesome!");\n}`
};

const FunctionModal = ({isOpen, onClose, functionToEdit, onSaved}: FunctionModalProps) => {
  const isEditMode = !!functionToEdit;
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [language, setLanguage] = useState<string>("javascript");
  const [timeout, setTimeout] = useState(10);
  const [warmWorkers, setWarmWorkers] = useState(0);
  const [concurrencyPerWorker, setConcurrencyPerWorker] = useState(1);
  const [error, setError] = useState("");

  const {data: information} = useGetFunctionInformationQuery();
  const [createFunction, {isLoading: isCreating}] = useCreateFunctionMutation();
  const [updateFunction, {isLoading: isUpdating}] = useUpdateFunctionMutation();
  const [updateIndex] = useUpdateFunctionIndexMutation();

  const isSaving = isCreating || isUpdating;

  const maxTimeout = information?.timeout ?? 120;

  const resetForm = useCallback(() => {
    setName("");
    setCategory("");
    setLanguage("javascript");
    setTimeout(10);
    setWarmWorkers(0);
    setConcurrencyPerWorker(1);
    setError("");
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    if (functionToEdit) {
      setName(functionToEdit.name ?? "");
      setCategory(functionToEdit.category ?? "");
      setLanguage(functionToEdit.language ?? "javascript");
      setTimeout(functionToEdit.timeout ?? 10);
      setWarmWorkers(functionToEdit.warmWorkers ?? 0);
      setConcurrencyPerWorker(functionToEdit.concurrencyPerWorker ?? 1);
    } else {
      resetForm();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, functionToEdit?._id]);

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
        const result = await updateFunction({
          id: functionToEdit._id,
          body: {
            name: trimmed,
            language: language as "javascript" | "typescript",
            timeout,
            category: trimmedCategory || undefined,
            warmWorkers,
            concurrencyPerWorker,
            // PUT /function/:id validates against the full function schema, which
            // requires `triggers`. It merges via $set, so echoing the existing
            // triggers back keeps them unchanged while satisfying validation.
            triggers: functionToEdit.triggers as TriggerMap
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
          warmWorkers,
          concurrencyPerWorker,
          triggers: {
            default: {type: "http", active: true, options: {method: "All"}}
          }
        }).unwrap();

        const exampleCode = TRIGGER_EXAMPLES.http;
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
    warmWorkers,
    concurrencyPerWorker,
    isEditMode,
    functionToEdit,
    createFunction,
    updateFunction,
    updateIndex,
    resetForm,
    onSaved,
    onClose
  ]);

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

          <div className={styles.timeoutField}>
            <div className={styles.timeoutHeader}>
              <Text size="small" className={styles.fieldLabel}>Warm Pool</Text>
              <div className={styles.timeoutValue}>
                <span className={styles.timeoutNumber}>{warmWorkers}</span>
                <span className={styles.timeoutUnit}>{warmWorkers === 1 ? "worker" : "workers"}</span>
              </div>
            </div>
            <input
              type="range"
              className={styles.slider}
              min={0}
              max={WARM_POOL_MAX}
              step={1}
              value={warmWorkers}
              style={{"--pct": `${(warmWorkers / WARM_POOL_MAX) * 100}%`} as React.CSSProperties}
              onChange={e => setWarmWorkers(Number(e.target.value))}
            />
            <div className={styles.timeoutRange}>
              <span className={styles.timeoutRangeLabel}>Off</span>
              <span className={styles.timeoutRangeLabel}>{WARM_POOL_MAX}</span>
            </div>
            <Text size="small" className={styles.warmPoolHint}>
              Pre-loaded workers kept ready so events skip the cold start. 0 disables warm workers.
            </Text>
          </div>

          <FlexElement direction="vertical" alignment="leftCenter" dimensionX="fill" gap={6}>
            <Text size="small" dimensionX="fill" className={styles.fieldLabel}>
              Concurrency per worker
            </Text>
            <NumberInput
              value={concurrencyPerWorker}
              onChange={v => setConcurrencyPerWorker(v && v >= 1 ? Math.floor(v) : 1)}
              inputProps={{min: 1, step: 1}}
              dimensionX="fill"
            />
            <Text size="small" className={styles.warmPoolHint}>
              Events this function runs in parallel per worker. Raise it only for I/O-bound handlers.
            </Text>
          </FlexElement>

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
            disabled={isSaving || !name.trim()}
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
