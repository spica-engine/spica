import React, {useState, useCallback, useMemo, useEffect} from "react";
import {Button, Drawer, FlexElement, Icon, Input, Select, Text, Chart} from "oziko-ui-kit";
import styles from "./AddComponentDrawer.module.scss";
import type {DashboardComponent, DashboardComponentType} from "../../../../store/api/dashboardApi";
import {DashboardRatio, CHART_TYPES, isChartType} from "../../../../store/api/dashboardApi";
import {dashboardExamples} from "../../../../pages/dashboard/utils/exampleData";
import type {ChartType} from "chart.js";

type AddComponentDrawerProps = {
  isOpen: boolean;
  component?: DashboardComponent;
  onSave: (component: DashboardComponent) => void;
  onDelete?: () => void;
  onClose: () => void;
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

const CHART_OPTIONS = {responsive: true, maintainAspectRatio: false} as const;

const RATIO_OPTIONS: {label: string; value: DashboardRatio}[] = [
  {label: "1/1", value: DashboardRatio.OneByOne},
  {label: "1/2", value: DashboardRatio.OneByTwo},
  {label: "2/1", value: DashboardRatio.TwoByOne},
  {label: "2/2", value: DashboardRatio.TwoByTwo},
  {label: "4/2", value: DashboardRatio.FourByTwo},
];

const AddComponentDrawer = ({
  isOpen,
  component,
  onSave,
  onDelete,
  onClose
}: AddComponentDrawerProps) => {
  const [name, setName] = useState(component?.name ?? "");
  const [url, setUrl] = useState(component?.url ?? "");
  const [type, setType] = useState<DashboardComponentType>(component?.type ?? "line");
  const [ratio, setRatio] = useState<DashboardRatio>(component?.ratio ?? DashboardRatio.TwoByTwo);

  // Reset form when component changes or drawer opens
  useEffect(() => {
    if (isOpen) {
      setName(component?.name ?? "");
      setUrl(component?.url ?? "");
      setType(component?.type ?? "line");
      setRatio(component?.ratio ?? DashboardRatio.TwoByTwo);
    }
  }, [isOpen, component]);

  const exampleJson = useMemo(() => dashboardExamples[type] ?? "{}", [type]);

  const previewData = useMemo(() => {
    try {
      return JSON.parse(exampleJson);
    } catch {
      return null;
    }
  }, [exampleJson]);

  const handleSave = useCallback(() => {
    onSave({name, url, type, ratio});
  }, [name, url, type, ratio, onSave]);

  const handleDelete = useCallback(() => {
    onDelete?.();
  }, [onDelete]);

  const chartData = useMemo(() => {
    if (!previewData) return null;
    return {
      labels: previewData.labels ?? [],
      datasets: previewData.datasets ?? []
    };
  }, [previewData]);

  const showChartPreview = isChartType(type) && chartData;

  return (
    <Drawer
      placement="right"
      size={400}
      isOpen={isOpen}
      onClose={onClose}
      showCloseButton={false}
    >
      <FlexElement
        dimensionX="fill"
        dimensionY="fill"
        direction="vertical"
        alignment="leftTop"
        className={styles.drawerContent}
      >
        <Text className={styles.drawerTitle}>
          {component ? "Edit Component" : "Add Component"}
        </Text>

        <FlexElement direction="vertical" dimensionX="fill" gap={14} className={styles.form}>
          {/* Name field */}
          <FlexElement direction="vertical" dimensionX="fill" gap={4}>
            <Text size="small" className={styles.fieldLabel}>
              Name
            </Text>
            <FlexElement gap={5} dimensionX="fill" className={styles.inputContainer}>
              <Icon name="formatQuoteClose" size="md" />
              <Input
                placeholder="Name"
                value={name}
                onChange={e => setName(e.target.value)}
                className={styles.input}
              />
            </FlexElement>
          </FlexElement>

          {/* URL / data source name field */}
          <FlexElement direction="vertical" dimensionX="fill" gap={4}>
            <Text size="small" className={styles.fieldLabel}>
              URL
            </Text>
            <FlexElement gap={5} dimensionX="fill" className={styles.inputContainer}>
              <Icon name="formatQuoteClose" size="md" />
              <Input
                placeholder="Name"
                value={url}
                onChange={e => setUrl(e.target.value)}
                className={styles.input}
              />
            </FlexElement>
          </FlexElement>

          {/* Type dropdown */}
          <FlexElement direction="vertical" dimensionX="fill" gap={4}>
            <Text size="small" className={styles.fieldLabel}>
              Type
            </Text>
            <Select
              options={TYPE_OPTIONS}
              value={type}
              onChange={v => setType(v as DashboardComponentType)}
              dimensionX="fill"
            />
          </FlexElement>

          {/* Aspect Ratio dropdown */}
          <FlexElement direction="vertical" dimensionX="fill" gap={4}>
            <Text size="small" className={styles.fieldLabel}>
              Aspect Ratio
            </Text>
            <Select
              options={RATIO_OPTIONS}
              value={ratio}
              onChange={v => setRatio(v as DashboardRatio)}
              dimensionX="fill"
            />
          </FlexElement>

          {/* Example Code & Chart section */}
          <FlexElement dimensionX="fill" className={styles.sectionHeader}>
            <Text className={styles.sectionTitle}>Example Code &amp; Chart</Text>
            <Icon name="help" size="sm" className={styles.helpIcon} />
          </FlexElement>

          <pre className={styles.codeBlock}>{exampleJson}</pre>

          {/* Chart preview */}
          {showChartPreview && chartData!.datasets && (
            <div className={styles.chartPreview}>
              <Chart
                type={type as ChartType}
                data={chartData!}
                options={CHART_OPTIONS}
                className={styles.chart}
              />
            </div>
          )}
        </FlexElement>

        {/* Footer buttons */}
        <FlexElement
          dimensionX="fill"
          alignment="rightCenter"
          gap={10}
          className={styles.footer}
        >
          <Button onClick={handleSave}>
            <Icon name="save" size="sm" />
            <Text className={styles.saveButtonText}>Save</Text>
          </Button>
          {onDelete && (
            <Button color="danger" onClick={handleDelete}>
              <Icon name="delete" size="sm" />
              <Text>Delete This Chart</Text>
            </Button>
          )}
        </FlexElement>
      </FlexElement>
    </Drawer>
  );
};

export default AddComponentDrawer;
