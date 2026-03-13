import React, {type ReactNode, memo, useMemo} from "react";
import styles from "./DashboardItem.module.scss";
import {Button, Icon, Text, Chart, type TypeChartComponentProps, FlexElement, FluidContainer} from "oziko-ui-kit";
import {type ChartType} from "chart.js";
import Section from "../../organisms/section/Section";

type TypeDashboardItem = {
  headerProps?: {
    content?: ReactNode;
    suffix?: ReactNode;
  };
  chartProps?: TypeChartComponentProps<ChartType>;
  onSettingsClick?: () => void;
};

const DashboardItem = ({headerProps, chartProps, onSettingsClick}: TypeDashboardItem) => {
  // Deep-clone chart data so Chart.js can safely mutate it
  const safeChartData = useMemo(
    () => (chartProps?.data ? JSON.parse(JSON.stringify(chartProps.data)) : null),
    [chartProps?.data]
  );

  return (
    <FlexElement className={styles.dashboardItem} dimensionX="fill" direction="vertical">
      <FluidContainer 
      dimensionX="fill" 
      mode="fill"
      root={{children: <Text>{headerProps?.content}</Text>, alignment: "leftTop"}}
        suffix={{
          children: <Button
            color="transparent"
            shape="circle"
            className={`${styles.settingButton} noDrag`}
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              onSettingsClick?.();
            }}
          >
            <Icon name="cog" className={styles.settingIcon} size="xs" />
          </Button>
        }}
        className={styles.header}
      />
      <FlexElement dimensionX="fill" dimensionY="fill" className={styles.content} >
        {safeChartData && (
          <Chart
            type={chartProps!.type!}
            data={safeChartData}
            options={chartProps!.options!}
            className={styles.chart}
          />
        )}
      </FlexElement>
    </FlexElement>
  );
};

export default memo(DashboardItem);
