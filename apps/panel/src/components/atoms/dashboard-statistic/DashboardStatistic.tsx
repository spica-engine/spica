import {memo} from "react";
import styles from "./DashboardStatistic.module.scss";
import {FlexElement, Icon, Text} from "oziko-ui-kit";
import type {DashboardRatio} from "../../../store/api/dashboardApi";
import type {IconName} from "oziko-ui-kit";

type StatisticData = {
  icon?: string;
  iconColor?: string;
  iconBg?: string;
  value: number;
  title: string;
  difference?: number;
};

type DashboardStatisticProps = {
  componentData?: StatisticData;
  ratio: DashboardRatio;
};

const DashboardStatistic = ({componentData}: DashboardStatisticProps) => {
  if (!componentData) return null;

  const {icon, iconColor, iconBg, value, title, difference} = componentData;
  const isPositive = (difference ?? 0) >= 0;

  return (
    <FlexElement
      className={styles.statisticCard}
      direction="vertical"
      alignment="leftCenter"
      gap={12}
      dimensionX="fill"
      dimensionY="fill"
    >
      {icon && (
        <div
          className={styles.iconCircle}
          style={{
            backgroundColor: iconBg ?? "var(--color-primary)",
            color: iconColor ?? "var(--color-font-secondary)"
          }}
        >
          <Icon name={icon as IconName} size="md" />
        </div>
      )}
      <Text className={styles.value}>{value?.toLocaleString() ?? "—"}</Text>
      <Text className={styles.titleText}>{title}</Text>
      {difference !== undefined && (
        <FlexElement gap={4} alignment="leftCenter">
          <span className={isPositive ? styles.positive : styles.negative}>
            {isPositive ? "▲" : "▼"}
          </span>
          <Text
            size="small"
            className={isPositive ? styles.positive : styles.negative}
          >
            {Math.abs(difference)}%
          </Text>
        </FlexElement>
      )}
    </FlexElement>
  );
};

export default memo(DashboardStatistic);
