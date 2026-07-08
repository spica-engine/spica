import {memo, useMemo} from "react";
import styles from "./StatSparklineTile.module.scss";
import {Chart, FlexElement, Icon, Text, type IconName} from "oziko-ui-kit";
import {formatCount, useChartTheme} from "../chart-kit/chartTheme";

type StatSparklineTileProps = {
  label: string;
  value: number;
  displayValue?: string;
  icon?: string;
  accent?: string;
  series?: number[];
  loading?: boolean;
};

const sparklineOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {legend: {display: false}, tooltip: {enabled: false}},
  scales: {x: {display: false}, y: {display: false}},
  elements: {point: {radius: 0}},
  animation: false
} as const;

const StatSparklineTile = ({
  label,
  value,
  displayValue,
  icon,
  accent,
  series,
  loading
}: StatSparklineTileProps) => {
  const theme = useChartTheme();
  const color = accent ?? theme.accent;

  const sparkData = useMemo(() => {
    if (!series || series.length < 2) return null;
    return {
      labels: series.map((_, index) => index),
      datasets: [
        {
          data: series,
          borderColor: color,
          backgroundColor: `${color}22`,
          borderWidth: 2,
          fill: true,
          tension: 0.4
        }
      ]
    };
  }, [series, color]);

  return (
    <FlexElement
      className={styles.statSparklineTile}
      direction="vertical"
      gap={8}
      dimensionX="fill"
      dimensionY="fill"
    >
      <FlexElement className={styles.head} alignment="leftCenter" gap={8} dimensionX="fill">
        {icon && (
          <div className={styles.iconChip} style={{color, backgroundColor: `${color}1f`}}>
            <Icon name={icon as IconName} size="sm" />
          </div>
        )}
        <Text className={styles.label}>{label}</Text>
      </FlexElement>

      <Text className={styles.value}>{loading ? "—" : (displayValue ?? formatCount(value))}</Text>

      <div className={styles.spark}>
        {sparkData ? (
          <Chart type="line" data={sparkData} options={sparklineOptions as any} />
        ) : (
          <div className={styles.bar} style={{backgroundColor: `${color}33`}}>
            <span className={styles.barFill} style={{backgroundColor: color}} />
          </div>
        )}
      </div>
    </FlexElement>
  );
};

export default memo(StatSparklineTile);
