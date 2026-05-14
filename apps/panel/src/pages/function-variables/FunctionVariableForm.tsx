/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React, {useCallback, useEffect, useMemo, useState} from "react";
import {Button, FlexElement, Icon, Select, StringInput, Text, TextAreaInput} from "oziko-ui-kit";
import type {TypeLabeledValue} from "oziko-ui-kit";
import {
  useCreateEnvVarMutation,
  useUpdateEnvVarMutation
} from "../../store/api/envVarApi";
import type {EnvVar} from "../../store/api/envVarApi";
import {
  useInjectEnvVarMutation,
  useEjectEnvVarMutation
} from "../../store/api/functionApi";
import type {SpicaFunction} from "../../store/api/functionApi";
import styles from "./FunctionVariablesPage.module.scss";

type FunctionVariableFormProps = {
  isOpen: boolean;
  selectedVariable: EnvVar | null;
  functionList: SpicaFunction[];
  assignedFunctionIds: string[];
  onClose: () => void;
};

const FunctionVariableForm = ({
  isOpen,
  selectedVariable,
  functionList,
  assignedFunctionIds,
  onClose
}: FunctionVariableFormProps) => {
  const [createEnvVar, {isLoading: isCreating}] = useCreateEnvVarMutation();
  const [updateEnvVar, {isLoading: isUpdating}] = useUpdateEnvVarMutation();
  const [injectEnvVar] = useInjectEnvVarMutation();
  const [ejectEnvVar] = useEjectEnvVarMutation();

  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [selectedFunctionIds, setSelectedFunctionIds] = useState<string[]>([]);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isEditMode = selectedVariable !== null;
  const isSaving = isCreating || isUpdating;

  useEffect(() => {
    if (isOpen) {
      setSubmitError(null);
      setKeyError(null);
      if (selectedVariable) {
        setKey(selectedVariable.key);
        setValue(selectedVariable.value);
        setSelectedFunctionIds(assignedFunctionIds);
      } else {
        setKey("");
        setValue("");
        setSelectedFunctionIds([]);
      }
    }
  }, [isOpen, selectedVariable, assignedFunctionIds]);

  const functionOptions = useMemo<TypeLabeledValue[]>(
    () => functionList.map(fn => ({value: fn._id!, label: fn.name})),
    [functionList]
  );

  const validateKey = useCallback((v: string): boolean => {
    if (!v.trim()) {
      setKeyError("Key is required");
      return false;
    }
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(v)) {
      setKeyError("Key must start with a letter or underscore and contain only letters, digits, and underscores");
      return false;
    }
    setKeyError(null);
    return true;
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!validateKey(key)) return;
    if (!value.trim()) {
      setSubmitError("Value is required");
      return;
    }
    setSubmitError(null);

    try {
      let envVarId: string;

      if (isEditMode && selectedVariable) {
        await updateEnvVar({id: selectedVariable._id, key, value}).unwrap();
        envVarId = selectedVariable._id;

        // Diff function assignments
        const prevSet = new Set(assignedFunctionIds);
        const nextSet = new Set(selectedFunctionIds);

        const toInject = selectedFunctionIds.filter(id => !prevSet.has(id));
        const toEject = assignedFunctionIds.filter(id => !nextSet.has(id));

        await Promise.all([
          ...toInject.map(functionId => injectEnvVar({functionId, envVarId}).unwrap()),
          ...toEject.map(functionId => ejectEnvVar({functionId, envVarId}).unwrap())
        ]);
      } else {
        const created = await createEnvVar({key, value}).unwrap();
        envVarId = created._id;

        // Inject into all selected functions
        await Promise.all(
          selectedFunctionIds.map(functionId => injectEnvVar({functionId, envVarId}).unwrap())
        );
      }

      onClose();
    } catch (err: any) {
      const message = err?.data?.message ?? err?.message ?? "An error occurred";
      setSubmitError(message);
    }
  }, [
    key,
    value,
    isEditMode,
    selectedVariable,
    assignedFunctionIds,
    selectedFunctionIds,
    createEnvVar,
    updateEnvVar,
    injectEnvVar,
    ejectEnvVar,
    onClose,
    validateKey
  ]);

  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <FlexElement
      dimensionX="fill"
      direction="vertical"
      alignment="leftTop"
      className={styles.drawerForm}
    >
      <FlexElement
        dimensionX="fill"
        direction="vertical"
        alignment="leftTop"
        gap={16}
        className={styles.drawerContent}
      >
        <Text className={styles.drawerTitle}>
          {isEditMode ? "Update Variable" : "New Variable"}
        </Text>

        <FlexElement dimensionX="fill" direction="vertical" gap={4}>
          <StringInput
            label="Key"
            value={key}
            onChange={(v) => {
              setKey(v);
              if (keyError) validateKey(v);
            }}
          />
          {keyError && <Text variant="danger">{keyError}</Text>}
        </FlexElement>

        <FlexElement dimensionX="fill" direction="vertical" gap={4}>
          
          <TextAreaInput
            title="Value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </FlexElement>

        <FlexElement dimensionX="fill" direction="vertical" gap={4}>
        
          <Select
            placeholder="Assigned Functions"
            options={functionOptions}
            value={selectedFunctionIds}
            onChange={(ids) => setSelectedFunctionIds(ids as string[])}
            multiple
            
          />
        </FlexElement>

        {submitError && <Text variant="danger">{submitError}</Text>}
      </FlexElement>

      <FlexElement
        dimensionX="fill"
        alignment="rightCenter"
        direction="horizontal"
        gap={10}
        className={styles.drawerActions}
      >
        <Button variant="solid" color="danger" type="button" onClick={handleCancel}>
          <Icon name="close" /> Cancel
        </Button>
        <Button
          variant="solid"
          color="primary"
          onClick={handleSubmit}
          disabled={!key.trim() || !value.trim() || isSaving}
          loading={isSaving}
        >
          <Icon name="check" /> {isEditMode ? "Update" : "Add Variable"}
        </Button>
      </FlexElement>
    </FlexElement>
  );
};

export default FunctionVariableForm;
