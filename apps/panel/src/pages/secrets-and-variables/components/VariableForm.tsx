import React, { useCallback, useEffect, useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { Button, FlexElement, Icon, StringInput, Text } from "oziko-ui-kit";
import {
  useCreateEnvVarMutation,
  useUpdateEnvVarMutation,
} from "../../../store/api/envVarApi";
import type { EnvVar } from "../../../store/api/envVarApi";
import styles from "../SecretsAndVariables.module.scss";

type VariableFormProps = {
  isOpen: boolean;
  selectedVariable: EnvVar | null;
  onClose: () => void;
};

const variableSchema = Yup.object({
  key: Yup.string()
    .required("Key is required")
    .matches(/^[A-Za-z_][A-Za-z0-9_]*$/, "Key must contain only letters, digits, and underscores, and start with a letter or underscore"),
  value: Yup.string().required("Value is required"),
});

type VariableFormValues = {
  key: string;
  value: string;
};

const initialValues: VariableFormValues = {
  key: "",
  value: "",
};

const VariableForm = ({ isOpen, selectedVariable, onClose }: VariableFormProps) => {
  const [createEnvVar, { isLoading: isCreating }] = useCreateEnvVarMutation();
  const [updateEnvVar, { isLoading: isUpdating }] = useUpdateEnvVarMutation();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isEditMode = selectedVariable !== null;

  const formik = useFormik<VariableFormValues>({
    initialValues,
    validationSchema: variableSchema,
    enableReinitialize: true,
    onSubmit: async (values) => {
      setSubmitError(null);
      try {
        if (isEditMode) {
          await updateEnvVar({
            id: selectedVariable._id,
            key: values.key,
            value: values.value,
          }).unwrap();
        } else {
          await createEnvVar({
            key: values.key,
            value: values.value,
          }).unwrap();
        }
        formik.resetForm();
        onClose();
      } catch (err: any) {
        const message = err?.data?.message || err?.message || "An error occurred";
        setSubmitError(message);
      }
    },
  });

  useEffect(() => {
    if (isOpen) {
      setSubmitError(null);
      if (selectedVariable) {
        formik.setValues({ key: selectedVariable.key, value: selectedVariable.value });
      } else {
        formik.resetForm();
      }
    }
  }, [isOpen, selectedVariable]);

  const handleCancel = useCallback(() => {
    formik.resetForm();
    onClose();
  }, [formik, onClose]);

  const hasEmptyFields = !formik.values.key.trim() || !formik.values.value.trim();
  const isSaving = isCreating || isUpdating;

  return (
    <form onSubmit={formik.handleSubmit} className={styles.drawerForm}>
      <FlexElement
        dimensionX="fill"
        direction="vertical"
        alignment="leftTop"
        gap={10}
        className={styles.drawerContent}
      >
        <Text className={styles.drawerTitle}>
          {isEditMode ? "Update variable" : "New variable"}
        </Text>

        <FlexElement dimensionX="fill" direction="vertical" gap={4}>
          <StringInput
            label="Name"
            value={formik.values.key}
            onChange={(v) => formik.setFieldValue("key", v)}
            onBlur={() => formik.setFieldTouched("key")}
          />
          {formik.touched.key && formik.errors.key && (
            <Text variant="danger">{formik.errors.key}</Text>
          )}
        </FlexElement>

        <FlexElement dimensionX="fill" direction="vertical" gap={4}>
          <StringInput
            label="Value"
            value={formik.values.value}
            onChange={(v) => formik.setFieldValue("value", v)}
            onBlur={() => formik.setFieldTouched("value")}
          />
          {formik.touched.value && formik.errors.value && (
            <Text variant="danger">{formik.errors.value}</Text>
          )}
        </FlexElement>

        {submitError && (
          <Text variant="danger">{submitError}</Text>
        )}
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
          type="submit"
          disabled={hasEmptyFields || isSaving}
          loading={isSaving}
        >
          <Icon name="plus" /> {isEditMode ? "Update variable" : "Add variable"}
        </Button>
      </FlexElement>
    </form>
  );
};

export default VariableForm;
