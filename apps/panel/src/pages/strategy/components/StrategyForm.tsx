/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React, { useCallback, useEffect, useState } from "react";
import { useFormik } from "formik";
import {
  Button,
  FlexElement,
  Icon,
  Select,
  StringInput,
  Text,
  TextAreaInput
} from "oziko-ui-kit";
import {
  useAddStrategyMutation,
  useUpdateStrategyMutation,
  type AddStrategyInput,
  type AuthenticationStrategy
} from "../../../store/api/authenticationStrategyApi";
import {
  STRATEGY_TYPE_OPTIONS,
  addStrategySchema,
  initialFormValues,
  strategyToFormValues,
  areFormValuesEqual,
  type AddStrategyFormValues
} from "../utils/strategyFormUtils";
import styles from "./StrategyForm.module.scss";

type StrategyFormProps = {
  isOpen: boolean;
  selectedStrategy: AuthenticationStrategy | null;
  onClose: () => void;
};

const StrategyForm = ({ isOpen, selectedStrategy, onClose }: StrategyFormProps) => {
  const [formBaseline, setFormBaseline] = useState<AddStrategyFormValues | null>(null);
  const [addStrategy, { isLoading: isAdding }] = useAddStrategyMutation();
  const [updateStrategy, { isLoading: isUpdating }] = useUpdateStrategyMutation();

  const formik = useFormik<AddStrategyFormValues>({
    initialValues: initialFormValues,
    validationSchema: addStrategySchema,
    enableReinitialize: true,
    onSubmit: async values => {
      if (formBaseline && areFormValuesEqual(values, formBaseline)) {
        return;
      }
      const payload: AddStrategyInput = {
        type: values.type,
        name: values.name.trim(),
        title: values.title.trim(),
        options: {
          ip: {
            login_url: values.loginUrl.trim(),
            logout_url: values.logoutUrl.trim(),
            certificate: values.certificate.trim()
          }
        },
        icon: "fingerprint"
      };
      try {
        if (selectedStrategy) {
          await updateStrategy({
            ...payload,
            _id: selectedStrategy._id,
            _hasChanges: true
          }).unwrap();
        } else {
          await addStrategy(payload).unwrap();
        }
        formik.resetForm();
        onClose();
      } catch {
        // Error handled by mutation
      }
    }
  });

  useEffect(() => {
    if (isOpen) {
      if (selectedStrategy) {
        const values = strategyToFormValues(selectedStrategy);
        formik.setValues(values);
        setFormBaseline(values);
      } else {
        formik.resetForm();
        setFormBaseline(initialFormValues);
      }
    } else {
      setFormBaseline(null);
    }
  }, [isOpen, selectedStrategy]);

  const handleCancel = useCallback(() => {
    formik.resetForm();
    onClose();
  }, [formik, onClose]);

  const hasEmptyFields =
    !formik.values.name.trim() ||
    !formik.values.title.trim() ||
    !formik.values.loginUrl.trim() ||
    !formik.values.logoutUrl.trim() ||
    !formik.values.certificate.trim();

  const hasNoChanges = formBaseline !== null && areFormValuesEqual(formik.values, formBaseline);
  const isSaving = isAdding || isUpdating;

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
          {selectedStrategy ? "Edit Strategy" : "Add New Strategy"}
        </Text>

        <FlexElement dimensionX="fill" direction="vertical" gap={4}>
          <StringInput
            label="Name"
            value={formik.values.name}
            onChange={v => formik.setFieldValue("name", v)}
            onBlur={() => formik.setFieldTouched("name")}
          />
          {formik.touched.name && formik.errors.name && (
            <Text variant="danger">{formik.errors.name}</Text>
          )}
        </FlexElement>

        <FlexElement dimensionX="fill" direction="vertical" gap={4}>
          <StringInput
            label="Title"
            value={formik.values.title}
            onChange={v => formik.setFieldValue("title", v)}
            onBlur={() => formik.setFieldTouched("title")}
          />
          {formik.touched.title && formik.errors.title && (
            <Text variant="danger">{formik.errors.title}</Text>
          )}
        </FlexElement>

        <FlexElement dimensionX="fill" direction="vertical" gap={4}>
          <Select
            dimensionX="fill"
            dimensionY={36}
            options={STRATEGY_TYPE_OPTIONS}
            value={formik.values.type}
            onChange={v => formik.setFieldValue("type", v)}
            placeholder="Select type"
          />
          {formik.touched.type && formik.errors.type && (
            <Text variant="danger">{formik.errors.type}</Text>
          )}
        </FlexElement>

        <FlexElement dimensionX="fill" direction="vertical" gap={4}>
          <StringInput
            label="Login URL"
            value={formik.values.loginUrl}
            onChange={v => formik.setFieldValue("loginUrl", v)}
            onBlur={() => formik.setFieldTouched("loginUrl")}
          />
          {formik.touched.loginUrl && formik.errors.loginUrl && (
            <Text variant="danger">{formik.errors.loginUrl}</Text>
          )}
        </FlexElement>

        <FlexElement dimensionX="fill" direction="vertical" gap={4}>
          <StringInput
            label="Logout URL"
            value={formik.values.logoutUrl}
            onChange={v => formik.setFieldValue("logoutUrl", v)}
            onBlur={() => formik.setFieldTouched("logoutUrl")}
          />
          {formik.touched.logoutUrl && formik.errors.logoutUrl && (
            <Text variant="danger">{formik.errors.logoutUrl}</Text>
          )}
        </FlexElement>

        <FlexElement dimensionX="fill" direction="vertical" gap={4}>
          <TextAreaInput
            title="Certificate"
            icon="notes"
            value={formik.values.certificate}
            onChange={e => formik.setFieldValue("certificate", e.target.value)}
          />
          {formik.touched.certificate && formik.errors.certificate && (
            <Text variant="danger">{formik.errors.certificate}</Text>
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
            <Icon name="close" />
            Cancel
          </Button>
          <Button
            variant="solid"
            color="primary"
            type="submit"
            disabled={hasEmptyFields || hasNoChanges || isSaving}
          >
            <Icon name="plus" />
            Save
          </Button>
        </FlexElement>
      </FlexElement>
    </form>
  );
};

export default StrategyForm;
