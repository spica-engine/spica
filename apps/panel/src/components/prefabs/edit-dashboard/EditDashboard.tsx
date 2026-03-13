import React, {useState, type FC, type ReactNode, useCallback} from "react";
import {Button, FlexElement, Icon, Input, Modal, Text, FluidContainer, Select} from "oziko-ui-kit";
import type {Dashboard, DashboardComponent, DashboardComponentType} from "../../../store/api/dashboardApi";
import {
  DashboardRatio,
  useCreateDashboardMutation,
  useUpdateDashboardMutation,
  getEmptyComponent
} from "../../../store/api/dashboardApi";
import styles from "./EditDashboard.module.scss";

type EditDashboardProps = {
  dashboard?: Dashboard;
  mode?: "edit" | "create";
  initialValue?: string;
  onCreated?: (dashboard: Dashboard) => void;
  children: (props: {
    isOpen: boolean;
    onOpen: (e: React.MouseEvent) => void;
    onClose: () => void;
  }) => ReactNode;
};

const TYPE_OPTIONS: {label: string; value: DashboardComponentType}[] = [
  {label: "Line", value: "line"},
  {label: "Bar", value: "bar"},
  {label: "Pie", value: "pie"},
  {label: "Doughnut", value: "doughnut"},
  {label: "Radar", value: "radar"},
  {label: "Scatter", value: "scatter"},
  {label: "Bubble", value: "bubble"},
  {label: "Polar Area", value: "polarArea"},
  {label: "Table", value: "table"},
  {label: "Card", value: "card"},
  {label: "Statistic", value: "statistic"}
];

const RATIO_OPTIONS: {label: string; value: DashboardRatio}[] = [
  {label: "1/1", value: DashboardRatio.OneByOne},
  {label: "1/2", value: DashboardRatio.OneByTwo},
  {label: "2/1", value: DashboardRatio.TwoByOne},
  {label: "2/2", value: DashboardRatio.TwoByTwo},
  {label: "4/2", value: DashboardRatio.FourByTwo},
  {label: "4/4", value: DashboardRatio.FourByFour}
];

const EditDashboard: FC<EditDashboardProps> = ({
  dashboard,
  mode = "edit",
  initialValue = "New Dashboard",
  onCreated,
  children
}) => {
  const [createDashboard] = useCreateDashboardMutation();
  const [updateDashboard] = useUpdateDashboardMutation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [value, setValue] = useState(dashboard?.name || initialValue);
  const [components, setComponents] = useState<DashboardComponent[]>(
    dashboard?.components ?? []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const isCreateMode = mode === "create" || !dashboard;

  const handleAddComponent = useCallback(() => {
    setComponents(prev => [...prev, getEmptyComponent()]);
  }, []);

  const handleRemoveComponent = useCallback((index: number) => {
    setComponents(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleComponentChange = useCallback(
    (index: number, field: keyof DashboardComponent, fieldValue: string) => {
      setComponents(prev =>
        prev.map((comp, i) => (i === index ? {...comp, [field]: fieldValue} : comp))
      );
    },
    []
  );

  const handleSave = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      if (!value.trim()) {
        setError("This field cannot be left empty.");
        return;
      }

      if (value.length < 3) {
        setError("This field must be at least 3 characters long");
        return;
      }

      if (value.length > 100) {
        setError("This field cannot exceed 100 characters");
        return;
      }

      if (isCreateMode) {
        const result = await createDashboard({
          name: value,
          icon: "dashboard",
          components
        }).unwrap();
        setIsModalOpen(false);
        onCreated?.(result);
      } else {
        await updateDashboard({
          id: dashboard!._id!,
          body: {name: value}
        }).unwrap();
        setIsModalOpen(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [value, components, isCreateMode, createDashboard, updateDashboard, dashboard, onCreated]);

  const handleClose = useCallback(() => {
    setIsModalOpen(false);
    setValue(dashboard?.name || initialValue);
    setComponents(dashboard?.components ?? []);
    setError("");
  }, [dashboard?.name, dashboard?.components, initialValue]);

  const handleOpen = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setValue(dashboard?.name || initialValue);
      setComponents(dashboard?.components ?? []);
      setIsModalOpen(true);
    },
    [dashboard?.name, dashboard?.components, initialValue]
  );

  // Edit mode — simple name-only modal
  if (!isCreateMode) {
    return (
      <>
        {children({
          isOpen: isModalOpen,
          onOpen: handleOpen,
          onClose: handleClose
        })}
        {isModalOpen && (
          <Modal showCloseButton={false} onClose={handleClose} className={styles.modal} isOpen>
            <FluidContainer
              className={`${styles.container} ${error ? styles.containerWithError : ""}`}
              direction="vertical"
              gap={10}
              mode="fill"
              prefix={{
                children: (
                  <div className={styles.header}>
                    <Text className={styles.headerText}>EDIT NAME</Text>
                  </div>
                )
              }}
              root={{
                children: (
                  <div>
                    <FlexElement gap={5} className={styles.inputContainer}>
                      <Icon name="formatQuoteClose" size="md" />
                      <Input
                        className={styles.input}
                        onChange={e => setValue(e.target.value)}
                        placeholder="Name"
                        value={value}
                      />
                    </FlexElement>
                    {error && (
                      <Text variant="danger" className={styles.errorText}>
                        {error}
                      </Text>
                    )}
                  </div>
                )
              }}
              suffix={{
                dimensionX: "fill",
                alignment: "rightCenter",
                children: (
                  <FlexElement gap={10} className={styles.buttonsContainer}>
                    <div className={styles.addButtonWrapper}>
                      <Button
                        className={styles.addButton}
                        onClick={handleSave}
                        disabled={loading}
                        loading={loading}
                      >
                        <Icon name="save" />
                        <Text className={styles.addButtonText}>Save</Text>
                      </Button>
                    </div>
                    <Button
                      className={styles.cancelButton}
                      variant="text"
                      onClick={handleClose}
                      disabled={loading}
                    >
                      <Icon name="close" />
                      <Text>Cancel</Text>
                    </Button>
                  </FlexElement>
                )
              }}
            />
          </Modal>
        )}
      </>
    );
  }

  // Create mode — full form with components
  return (
    <>
      {children({
        isOpen: isModalOpen,
        onOpen: handleOpen,
        onClose: handleClose
      })}
      {isModalOpen && (
        <Modal
          showCloseButton={false}
          onClose={handleClose}
          className={styles.createModal}
          isOpen
        >
          <FlexElement
            direction="vertical"
            dimensionX="fill"
            className={styles.createContainer}
          >
            {/* Dashboard Name */}
            <Input
              placeholder="Name *"
              value={value}
              onChange={e => setValue(e.target.value)}
              className={styles.dashboardNameInput}
            />
            {error && (
              <Text variant="danger" className={styles.errorText}>
                {error}
              </Text>
            )}

            {/* Components Section */}
            <Text className={styles.componentsHeader}>Components</Text>

            <FlexElement direction="vertical" dimensionX="fill" gap={16}>
              {components.map((comp, index) => (
                <FlexElement key={index} direction="vertical" dimensionX="fill" gap={4}>
                  <FlexElement dimensionX="fill" gap={10} alignment="leftCenter">
                    <Input
                      placeholder="Name *"
                      value={comp.name}
                      onChange={e => handleComponentChange(index, "name", e.target.value)}
                      className={styles.componentInput}
                    />
                    <Input
                      placeholder="Url *"
                      value={comp.url}
                      onChange={e => handleComponentChange(index, "url", e.target.value)}
                      className={styles.componentInput}
                    />
                    <Select
                      options={TYPE_OPTIONS}
                      value={comp.type}
                      onChange={v =>
                        handleComponentChange(index, "type", v as string)
                      }
                      dimensionX="fill"
                      placeholder="Type *"
                    />
                    <FlexElement direction="vertical" gap={2}>
                      <Text size="xsmall" className={styles.ratioLabel}>
                        Aspect/Ratio
                      </Text>
                      <Select
                        options={RATIO_OPTIONS}
                        value={comp.ratio}
                        onChange={v =>
                          handleComponentChange(index, "ratio", v as string)
                        }
                        dimensionX="fill"
                      />
                    </FlexElement>
                    <Button
                      variant="icon"
                      className={styles.componentActionButton}
                    >
                      <Icon name="help" size="md" />
                    </Button>
                    <Button
                      variant="icon"
                      color="danger"
                      className={styles.componentActionButton}
                      onClick={() => handleRemoveComponent(index)}
                    >
                      <Icon name="delete" size="md" />
                    </Button>
                  </FlexElement>
                  <Text size="xsmall" className={styles.urlHint}>
                    Url address that will return the content of this component.
                  </Text>
                </FlexElement>
              ))}

              {/* Add New Component */}
              <button
                type="button"
                className={styles.addComponentButton}
                onClick={handleAddComponent}
              >
                <Icon name="plus" size="sm" />
                <Text size="medium">Add New Component</Text>
              </button>
            </FlexElement>

            {/* Footer */}
            <FlexElement dimensionX="fill" alignment="rightCenter" className={styles.createFooter}>
              <Button
                onClick={handleSave}
                disabled={loading}
                loading={loading}
              >
                <Icon name="save" />
                <Text className={styles.addButtonText}>Save</Text>
              </Button>
            </FlexElement>
          </FlexElement>
        </Modal>
      )}
    </>
  );
};

export default EditDashboard;
