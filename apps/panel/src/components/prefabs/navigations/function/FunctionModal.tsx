/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React, {memo, useCallback, useEffect, useMemo, useState} from "react";
import {Button, Drawer, FlexElement, Icon, NumberInput, Select, StringInput, Text} from "oziko-ui-kit";
import {
  useCreateFunctionMutation,
  useUpdateFunctionMutation,
  useUpdateFunctionIndexMutation,
  useGetFunctionInformationQuery
} from "../../../../store/api/functionApi";
import DynamicValueField from "../../../molecules/dynamic-value-field/DynamicValueField";
import {useFunctionPlaceholderSources} from "../../../../hooks/useFunctionPlaceholderSources";
import {isPlaceholder} from "../../../../domain/placeholder";
import type {SpicaFunction, TriggerMap} from "../../../../store/api/functionApi";
import styles from "./FunctionModal.module.scss";
import { idOf } from "../../../../utils/recordKey";

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
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [language, setLanguage] = useState<string>("javascript");
  const [timeout, setTimeout] = useState<number | string>(10);
  const [warmWorkers, setWarmWorkers] = useState<number | string>(0);
  const [concurrencyPerWorker, setConcurrencyPerWorker] = useState<number | string>(1);
  const [error, setError] = useState("");
  const [createdFunction, setCreatedFunction] = useState<SpicaFunction>();
  const target = functionToEdit ?? createdFunction;
  const isEditMode = !!target;
  const {fieldSources, attach} = useFunctionPlaceholderSources(target);

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
    setCreatedFunction(undefined);
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
  }, [isOpen, idOf(functionToEdit)]);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const dynamicValues = useMemo(
    () => [timeout, warmWorkers, concurrencyPerWorker],
    [timeout, warmWorkers, concurrencyPerWorker]
  );

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

    if (dynamicValues.includes("")) {
      setError("Select an environment variable or secret for every dynamic field.");
      return;
    }

    const trimmedCategory = category.trim();

    try {
      if (isEditMode && idOf(target)) {
        await attach(idOf(target)!, dynamicValues);
        const result = await updateFunction({
          id: idOf(target)!,
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
            triggers: target.triggers as TriggerMap
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
        setCreatedFunction(result);

        const exampleCode = TRIGGER_EXAMPLES.http;
        if (idOf(result)) {
          await updateIndex({id: idOf(result)!, index: exampleCode}).unwrap();
          await attach(idOf(result)!, dynamicValues);
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
    target,
    dynamicValues,
    attach,
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

          <DynamicValueField
            label="Timeout"
            value={timeout}
            defaultStaticValue={10}
            {...fieldSources}
            onChange={setTimeout}
            renderStatic={value => (
              <div className={styles.timeoutField}>
                <div className={styles.timeoutHeader}>
                  <div className={styles.timeoutValue}>
                    <span className={styles.timeoutNumber}>{value}</span>
                    <span className={styles.timeoutUnit}>seconds</span>
                  </div>
                </div>
                <input
                  type="range"
                  className={styles.slider}
                  min={1}
                  max={maxTimeout}
                  step={1}
                  value={value}
                  style={{"--pct": `${((value - 1) / (maxTimeout - 1)) * 100}%`} as React.CSSProperties}
                  onChange={e => setTimeout(Number(e.target.value))}
                />
                <div className={styles.timeoutRange}>
                  <span className={styles.timeoutRangeLabel}>1s</span>
                  <span className={styles.timeoutRangeLabel}>{maxTimeout}s</span>
                </div>
              </div>
            )}
          />

          <DynamicValueField
            label="Warm Pool"
            value={warmWorkers}
            defaultStaticValue={0}
            {...fieldSources}
            onChange={setWarmWorkers}
            renderStatic={value => (
              <div className={styles.timeoutField}>
                <div className={styles.timeoutHeader}>
                  <div className={styles.timeoutValue}>
                    <span className={styles.timeoutNumber}>{value}</span>
                    <span className={styles.timeoutUnit}>{value === 1 ? "worker" : "workers"}</span>
                  </div>
                </div>
                <input
                  type="range"
                  className={styles.slider}
                  min={0}
                  max={WARM_POOL_MAX}
                  step={1}
                  value={value}
                  style={{"--pct": `${(value / WARM_POOL_MAX) * 100}%`} as React.CSSProperties}
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
            )}
          />

          <DynamicValueField
            label="Concurrency per worker"
            value={concurrencyPerWorker}
            defaultStaticValue={1}
            {...fieldSources}
            onChange={setConcurrencyPerWorker}
            renderStatic={value => (
              <div className={styles.timeoutField}>
                <NumberInput
                  value={value}
                  onChange={v => setConcurrencyPerWorker(v && v >= 1 ? Math.floor(v) : 1)}
                  inputProps={{min: 1, step: 1}}
                  dimensionX="fill"
                />
                <Text size="small" className={styles.warmPoolHint}>
                  Events this function runs in parallel per worker. Raise it only for I/O-bound handlers.
                </Text>
              </div>
            )}
          />

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
