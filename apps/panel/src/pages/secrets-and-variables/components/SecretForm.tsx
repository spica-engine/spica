import React, { useCallback, useEffect, useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { Button, FlexElement, Icon, StringInput, Text, TextAreaInput } from "oziko-ui-kit";
import {
  useCreateSecretMutation,
  useUpdateSecretMutation,
} from "../../../store/api/secretApi";
import type { Secret } from "../../../store/api/secretApi";
import styles from "../SecretsAndVariables.module.scss";

type SecretFormProps = {
  isOpen: boolean;
  selectedSecret: Secret | null;
  onClose: () => void;
};

const secretSchema = Yup.object({
  key: Yup.string()
    .required("Key is required")
    .matches(/^[A-Za-z_][A-Za-z0-9_]*$/, "Key must contain only letters, digits, and underscores, and start with a letter or underscore"),
  value: Yup.string().required("Value is required"),
});

type SecretFormValues = {
  key: string;
  value: string;
};

const initialValues: SecretFormValues = {
  key: "",
  value: "",
};

const SecretForm = ({ isOpen, selectedSecret, onClose }: SecretFormProps) => {
  const [createSecret, { isLoading: isCreating, error: createError }] = useCreateSecretMutation();
  const [updateSecret, { isLoading: isUpdating, error: updateError }] = useUpdateSecretMutation();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isEditMode = selectedSecret !== null;

  const formik = useFormik<SecretFormValues>({
    initialValues,
    validationSchema: secretSchema,
    enableReinitialize: true,
    onSubmit: async (values) => {
      setSubmitError(null);
      try {
        if (isEditMode) {
          await updateSecret({
            id: selectedSecret._id,
            key: values.key,
            value: values.value,
          }).unwrap();
        } else {
          await createSecret({
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
      if (selectedSecret) {
        formik.setValues({ key: selectedSecret.key, value: "" });
      } else {
        formik.resetForm();
      }
    }
  }, [isOpen, selectedSecret]);

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
          {isEditMode ? "Update secret" : "New secret"}
        </Text>

        <FlexElement dimensionX="fill" direction="vertical" gap={4}>
          <StringInput
            label="Name"
            value={formik.values.key}
            onChange={(v) => formik.setFieldValue("key", v)}
            onBlur={() => formik.setFieldTouched("key")}
            inputProps={{ readOnly: isEditMode }}
          />
          {formik.touched.key && formik.errors.key && (
            <Text variant="danger">{formik.errors.key}</Text>
          )}
        </FlexElement>

        <FlexElement dimensionX="fill" direction="vertical" gap={4}>
          <TextAreaInput
            title="Value"
            icon="notes"
            value={formik.values.value}
            onChange={(e) => formik.setFieldValue("value", e.target.value)}
          />
          {isEditMode && (
            <Text className={styles.fieldHint}>
              Secret values are encrypted and never displayed. Enter the new value to update.
            </Text>
          )}
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
          <Icon name="plus" /> {isEditMode ? "Update secret" : "Add secret"}
        </Button>
      </FlexElement>
    </form>
  );
};

export default SecretForm;
