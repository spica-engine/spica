/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React, {useCallback, useEffect, useState} from "react";
import {useFormik} from "formik";
import * as Yup from "yup";
import {
  Button,
  Drawer,
  FlexElement,
  FluidContainer,
  Icon,
  Select,
  StringInput,
  Text,
  TextAreaInput,
  type IconName
} from "oziko-ui-kit";
import styles from "./Strategy.module.scss";
import Page from "../../components/organisms/page-layout/Page";
import Confirmation from "../../components/molecules/confirmation/Confirmation";
import {
  useAddStrategyMutation,
  useDeleteStrategyMutation,
  useUpdateStrategyMutation,
  useGetAuthenticationStrategiesQuery,
  type AddStrategyInput,
  type AuthenticationStrategy
} from "../../store/api/authenticationStrategyApi";

const STRATEGY_TYPE_OPTIONS = [
  {value: "saml", label: "SAML"},
  {value: "oauth", label: "OAuth"}
];

const addStrategySchema = Yup.object({
  name: Yup.string().required("Name is required"),
  title: Yup.string().required("Title is required"),
  type: Yup.string().oneOf(["saml", "oauth"]).required("Type is required"),
  loginUrl: Yup.string().required("Login URL is required"),
  logoutUrl: Yup.string().required("Logout URL is required"),
  certificate: Yup.string().required("Certificate is required")
});

type AddStrategyFormValues = Yup.InferType<typeof addStrategySchema>;

const initialFormValues: AddStrategyFormValues = {
  name: "",
  title: "",
  type: "saml",
  loginUrl: "",
  logoutUrl: "",
  certificate: ""
};

const strategyToFormValues = (strategy: AuthenticationStrategy): AddStrategyFormValues => ({
  name: strategy.name ?? "",
  title: strategy.title ?? "",
  type: strategy.type === "oauth" ? "oauth" : "saml",
  loginUrl: strategy.options?.ip?.login_url ?? "",
  logoutUrl: strategy.options?.ip?.logout_url ?? "",
  certificate: strategy.options?.ip?.certificate ?? ""
});

const areFormValuesEqual = (a: AddStrategyFormValues, b: AddStrategyFormValues): boolean =>
  a.name.trim() === b.name.trim() &&
  a.title.trim() === b.title.trim() &&
  a.type === b.type &&
  a.loginUrl.trim() === b.loginUrl.trim() &&
  a.logoutUrl.trim() === b.logoutUrl.trim() &&
  a.certificate.trim() === b.certificate.trim();

const Strategy = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<AuthenticationStrategy | null>(null);
  const [formBaseline, setFormBaseline] = useState<AddStrategyFormValues | null>(null);
  const {data: strategies, isLoading, error} = useGetAuthenticationStrategiesQuery();
  const [addStrategy, {isLoading: isAdding}] = useAddStrategyMutation();
  const [updateStrategy, {isLoading: isUpdating}] = useUpdateStrategyMutation();
  const [deleteStrategy, {isLoading: isDeleting}] = useDeleteStrategyMutation();
  const [strategyToDelete, setStrategyToDelete] = useState<AuthenticationStrategy | null>(null);

  const handleOpenDrawer = useCallback(() => {
    setSelectedStrategy(null);
    setIsDrawerOpen(true);
  }, []);
  const handleOpenStrategyDrawer = useCallback((strategy: AuthenticationStrategy) => {
    setSelectedStrategy(strategy);
    setIsDrawerOpen(true);
  }, []);
  const handleCloseDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    setSelectedStrategy(null);
  }, []);

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
        handleCloseDrawer();
      } catch {}
    }
  });

  useEffect(() => {
    if (isDrawerOpen) {
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
  }, [isDrawerOpen, selectedStrategy]);

  const handleCancel = useCallback(() => {
    formik.resetForm();
    handleCloseDrawer();
  }, [formik, handleCloseDrawer]);

  const handleDeleteClick = useCallback((e: React.MouseEvent, strategy: AuthenticationStrategy) => {
    e.stopPropagation();
    setStrategyToDelete(strategy);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!strategyToDelete) return;
    try {
      await deleteStrategy(strategyToDelete._id).unwrap();
      setStrategyToDelete(null);
    } catch {}
  }, [strategyToDelete, deleteStrategy]);

  const handleCancelDelete = useCallback(() => setStrategyToDelete(null), []);

  const hasEmptyFields =
    !formik.values.name.trim() ||
    !formik.values.title.trim() ||
    !formik.values.loginUrl.trim() ||
    !formik.values.logoutUrl.trim() ||
    !formik.values.certificate.trim();

  const hasNoChanges = formBaseline !== null && areFormValuesEqual(formik.values, formBaseline);

  const isSaving = isAdding || isUpdating;

  const renderContent = () => {
    if (isLoading) {
      return (
    Array.from({length: 3}).map((_, index) => (
      <FlexElement key={index} dimensionX="fill" direction="horizontal" className={styles.skeletonStrategyItem}>
       {" "}
      </FlexElement>
    ))
      );
    }

    if (error) {
      return <Text variant="danger">Error loading strategies. Please try again.</Text>;
    }

    if (!strategies || strategies.length === 0) {
      return <Text>No strategies available.</Text>;
    }

    return strategies.map(strategy => (
      <FluidContainer
        key={strategy._id}
        mode="fill"
        alignment="center"
        className={styles.strategyItem}
        onClick={() => handleOpenStrategyDrawer(strategy)}
        prefix={{
          children: <Icon name={strategy.icon as IconName} />
        }}
        root={{
          children: <Text>{strategy.title || strategy.name}</Text>,
          className: styles.strategyItemText,
          alignment: "leftCenter"
        }}
        suffix={{
          children: (
            <Button
              variant="icon"
              color="danger"
              onClick={e => handleDeleteClick(e, strategy)}
              className={styles.deleteButton}
            >
              <Icon name="delete" />
            </Button>
          )
        }}
      />
    ));
  };

  return (
    <Page title="AVAILABLE STRATEGIES">
      <FlexElement
        dimensionX="fill"
        direction="horizontal"
        alignment="leftTop"
        gap={0}
        className={styles.strategyContainer}
      >
        <Button className={styles.addStrategyButton} onClick={handleOpenDrawer}>
          <Icon name="plus" /> Add New Strategy
        </Button>
        {renderContent()}
      </FlexElement>

      <Drawer
        placement="right"
        size={600}
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        showCloseButton={false}
      >
        <form onSubmit={formik.handleSubmit} className={styles.drawerForm}>
          <FlexElement
            dimensionX="fill"
            direction="vertical"
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
              <Text>Type</Text>
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
              <Button variant="solid" color="default" type="button" onClick={handleCancel}>
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
      </Drawer>

      {strategyToDelete && (
        <Confirmation
          title="Delete Strategy"
          description={
            <>
              <span className={styles.confirmText}>
                This action will permanently delete this strategy.
              </span>
              <span className={styles.confirmHint}>
                Please type <strong>{strategyToDelete.name}</strong> to confirm deletion.
              </span>
            </>
          }
          confirmLabel="Delete"
          cancelLabel="Cancel"
          showInput
          inputPlaceholder="Strategy name"
          confirmCondition={input => input.trim() === strategyToDelete.name?.trim()}
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
          loading={isDeleting}
        />
      )}
    </Page>
  );
};

export default Strategy;
