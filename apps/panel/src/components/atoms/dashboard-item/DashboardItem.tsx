import React, {type ReactNode} from "react";
import styles from "./DashboardItem.module.scss";
import {Button, Icon, Text, Chart} from "oziko-ui-kit";
import {type ChartType} from "chart.js";
import Section from "../../organisms/section/Section";
import type {TypeChartComponentProps} from "../../../../../../node_modules/oziko-ui-kit/dist/components/atoms/chart/Chart";

type TypeDashboardItem = {
  headerProps?: {
    content?: ReactNode;
    suffix?: ReactNode;
  };
  chartProps?: TypeChartComponentProps<ChartType>;
};

const DashboardItem = ({headerProps, chartProps}: TypeDashboardItem) => {
  return (
    <Section className={styles.dashboardItem}>
      <Section.Header>
        <Text>{headerProps?.content}</Text>
        {headerProps?.suffix || (
          <Button
            color="transparent"
            shape="circle"
            className={styles.settingButton}
            //TODO: add hover effect
          >
            <Icon name="cog" className={styles.settingIcon} size="xs" />
          </Button>
        )}
      </Section.Header>
      <Section.Content>
        <Chart
          type={chartProps?.type!}
          data={chartProps?.data!}
          options={chartProps?.options!}
          className={styles.chart}
        />
      </Section.Content>
    </Section>
  );
};

export default DashboardItem;
