import React, { useCallback, useEffect, useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import {
  useCreateSecretMutation,
  useUpdateSecretMutation,
} from "../../../store/api/secretApi";
import type { Secret } from "../../../store/api/secretApi";
import {
  useCreateEnvVarMutation,
  useUpdateEnvVarMutation,
} from "../../../store/api/envVarApi";
import type { EnvVar } from "../../../store/api/envVarApi";
import styles from "../SecretsAndVariables.module.scss";

type EntryType = "secret" | "variable";

type EntryFormProps = {
  isOpen: boolean;
  defaultType?: EntryType;
  selectedSecret?: Secret | null;
  selectedVariable?: EnvVar | null;
  onClose: () => void;
};

const entrySchema = Yup.object({
  key: Yup.string()
    .required("Key is required")
    .matches(
      /^[A-Za-z_][A-Za-z0-9_]*$/,
      "Key must contain only letters, digits, and underscores, and start with a letter or underscore"
    ),
  value: Yup.string().required("Value is required"),
});

const EntryForm = ({
  isOpen,
  defaultType = "variable",
  selectedSecret,
  selectedVariable,
  onClose,
}: EntryFormProps) => {
  const isEditSecret = selectedSecret != null;
  const isEditVariable = selectedVariable != null;
  const isEditMode = isEditSecret || isEditVariable;

  const [entryType, setEntryType] = useState<EntryType>(
    isEditSecret ? "secret" : isEditVariable ? "variable" : defaultType
  );

  const [createSecret, { isLoading: isCreatingSecret }] = useCreateSecretMutation();
  const [updateSecret, { isLoading: isUpdatingSecret }] = useUpdateSecretMutation();
  const [createEnvVar, { isLoading: isCreatingVar }] = useCreateEnvVarMutation();
  const [updateEnvVar, { isLoading: isUpdatingVar }] = useUpdateEnvVarMutation();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isSaving = isCreatingSecret || isUpdatingSecret || isCreatingVar || isUpdatingVar;

  const formik = useFormik({
    initialValues: { key: "", value: "" },
    validationSchema: entrySchema,
    enableReinitialize: true,
    onSubmit: async (values) => {
      setSubmitError(null);
      try {
        if (isEditSecret && selectedSecret) {
          await updateSecret({ id: selectedSecret._id, key: values.key, value: values.value }).unwrap();
        } else if (isEditVariable && selectedVariable) {
          await updateEnvVar({ id: selectedVariable._id, key: values.key, value: values.value }).unwrap();
        } else if (entryType === "secret") {
          await createSecret({ key: values.key, value: values.value }).unwrap();
        } else {
          await createEnvVar({ key: values.key, value: values.value }).unwrap();
        }
        formik.resetForm();
        onClose();
      } catch (err: any) {
        setSubmitError(err?.data?.message || err?.message || "An error occurred");
      }
    },
  });

  useEffect(() => {
    if (isOpen) {
      setSubmitError(null);
      if (isEditSecret && selectedSecret) {
        formik.setValues({ key: selectedSecret.key, value: "" });
        setEntryType("secret");
      } else if (isEditVariable && selectedVariable) {
        formik.setValues({ key: selectedVariable.key, value: selectedVariable.value });
        setEntryType("variable");
      } else {
        formik.resetForm();
        setEntryType(defaultType);
      }
    }
  }, [isOpen, selectedSecret, selectedVariable]);

  const handleCancel = useCallback(() => {
    formik.resetForm();
    onClose();
  }, [formik, onClose]);

  const title = isEditSecret
    ? "Update Secret"
    : isEditVariable
      ? "Update Variable"
      : entryType === "secret"
        ? "New Secret"
        : "New Variable";

  const hasEmptyFields = !formik.values.key.trim() || !formik.values.value.trim();

  return (
    <form onSubmit={formik.handleSubmit} className={styles.entryForm}>
      {/* Header */}
      <div className={styles.entryFormHead}>
        <span className={styles.entryFormTitle}>{title}</span>
        <button type="button" className={styles.entryFormClose} onClick={handleCancel} aria-label="Close">
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className={styles.entryFormBody}>

        {/* Type toggle — create mode only */}
        {!isEditMode && (
          <div>
            <div className={styles.fieldLabel}>Type</div>
            <div className={styles.typeToggle}>
              <button
                type="button"
                className={entryType === "secret" ? styles.typeBtnActive : styles.typeBtn}
                onClick={() => setEntryType("secret")}
              >
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Secret
              </button>
              <button
                type="button"
                className={entryType === "variable" ? styles.typeBtnActive : styles.typeBtn}
                onClick={() => setEntryType("variable")}
              >
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <polyline points="4 7 4 4 20 4 20 7" />
                  <line x1="9" y1="20" x2="15" y2="20" />
                  <line x1="12" y1="4" x2="12" y2="20" />
                </svg>
                Variable
              </button>
            </div>
          </div>
        )}

        {/* Name */}
        <div>
          <div className={styles.fieldLabel}>Name</div>
          <div className={styles.fieldRow}>
            <div className={styles.fieldIcon}>
              {entryType === "secret" ? (
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              ) : (
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <polyline points="4 7 4 4 20 4 20 7" />
                  <line x1="9" y1="20" x2="15" y2="20" />
                  <line x1="12" y1="4" x2="12" y2="20" />
                </svg>
              )}
            </div>
            <input
              className={styles.fieldInput}
              type="text"
              placeholder={entryType === "secret" ? "MY_SECRET_KEY" : "MY_VARIABLE_NAME"}
              value={formik.values.key}
              onChange={(e) => formik.setFieldValue("key", e.target.value)}
              onBlur={() => formik.setFieldTouched("key")}
              readOnly={isEditMode}
              autoComplete="off"
            />
          </div>
          {formik.touched.key && formik.errors.key && (
            <div className={styles.fieldError}>{formik.errors.key}</div>
          )}
        </div>

        {/* Value */}
        <div>
          <div className={styles.fieldLabel}>Value</div>
          <div className={styles.fieldRow}>
            <div className={styles.fieldIcon}>
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" />
                <line x1="16" y1="8" x2="2" y2="22" />
                <line x1="17.5" y1="15" x2="9" y2="15" />
              </svg>
            </div>
            <input
              className={styles.fieldInput}
              type={entryType === "secret" ? "password" : "text"}
              placeholder={entryType === "secret" ? "••••••••" : "value"}
              value={formik.values.value}
              onChange={(e) => formik.setFieldValue("value", e.target.value)}
              onBlur={() => formik.setFieldTouched("value")}
              autoComplete="off"
            />
          </div>
          {isEditMode && entryType === "secret" && (
            <div className={styles.fieldHint}>
              Secret values are encrypted. Enter a new value to update.
            </div>
          )}
          {formik.touched.value && formik.errors.value && (
            <div className={styles.fieldError}>{formik.errors.value}</div>
          )}
        </div>

        {submitError && (
          <div className={styles.fieldError}>{submitError}</div>
        )}
      </div>

      {/* Footer */}
      <div className={styles.entryFormFoot}>
        <button type="button" className={styles.btnCancel} onClick={handleCancel}>
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          Cancel
        </button>
        <button
          type="submit"
          className={styles.btnSave}
          disabled={hasEmptyFields || isSaving}
        >
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
          {isSaving ? "Saving…" : isEditMode ? "Update" : "Save"}
        </button>
      </div>
    </form>
  );
};

export default EntryForm;
