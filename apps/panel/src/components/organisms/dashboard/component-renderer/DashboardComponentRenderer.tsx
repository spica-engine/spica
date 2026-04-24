import React, {type FC, useMemo} from "react";
import styles from "./DashboardComponentRenderer.module.scss";
import {Text} from "oziko-ui-kit";
import type {DashboardComponent} from "../../../../store/api/dashboardApi";
import {isChartType} from "../../../../store/api/dashboardApi";
import type {ChartType} from "chart.js";
import DashboardItem from "../../../atoms/dashboard-item/DashboardItem";
import DashboardTable from "../../../atoms/dashboard-table/DashboardTable";
import DashboardCard from "../../../atoms/dashboard-card/DashboardCard";
import DashboardStatistic from "../../../atoms/dashboard-statistic/DashboardStatistic";
import {normalizeChartData, normalizeTableData} from "../utils/transformComponentData";

type Props = {
  component: DashboardComponent;
  data: any;
  isLoading?: boolean;
  error?: any;
  onSettingsClick: () => void;
  onUpdate?: (filter: object) => void;
};

const DashboardComponentRenderer: FC<Props> = ({
  component,
  data,
  isLoading,
  error,
  onSettingsClick,
  onUpdate,
}) => {
  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <Text size="small">Failed to load component</Text>
      </div>
    );
  }

  if (isChartType(component.type)) {
    return (
      <ChartRenderer
        component={component}
        data={data}
        onSettingsClick={onSettingsClick}
      />
    );
  }

  switch (component.type) {
    case "table":
      return (
        <TableRenderer
          component={component}
          data={data}
          onUpdate={onUpdate}
        />
      );
    case "card":
      return (
        <DashboardCard
          componentData={data}
          ratio={component.ratio}
          title={component.name}
          onUpdate={onUpdate}
        />
      );
    case "statistic":
      return (
        <DashboardStatistic componentData={data} ratio={component.ratio} />
      );
    default:
      return null;
  }
};

// ---------------------------------------------------------------------------
// Sub-renderers (keep parent component lean)
// ---------------------------------------------------------------------------

const ChartRenderer: FC<{
  component: DashboardComponent;
  data: any;
  onSettingsClick: () => void;
}> = ({component, data, onSettingsClick}) => {
  const chartData = useMemo(() => normalizeChartData(data), [data]);

  return (
    <DashboardItem
      chartProps={{
        type: component.type as ChartType,
        data: chartData,
        options: {},
      }}
      headerProps={{content: component.name}}
      onSettingsClick={onSettingsClick}
    />
  );
};

const TableRenderer: FC<{
  component: DashboardComponent;
  data: any;
  onUpdate?: (filter: object) => void;
}> = ({component, data, onUpdate}) => {
  const normalized = useMemo(() => normalizeTableData(data), [data]);

  return (
    <DashboardTable
      componentData={normalized}
      ratio={component.ratio}
      title={component.name}
      onUpdate={onUpdate}
    />
  );
};

export default DashboardComponentRenderer;
