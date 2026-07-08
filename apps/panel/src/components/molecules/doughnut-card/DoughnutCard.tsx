import {memo, useMemo} from "react";
import styles from "./DoughnutCard.module.scss";
import {Chart, FlexElement, Text} from "oziko-ui-kit";
import {useChartTheme} from "../chart-kit/chartTheme";

export type DoughnutSegment = {label: string; value: number};

type DoughnutCardProps = {
  title: string;
  segments: DoughnutSegment[];
  loading?: boolean;
  emptyMessage?: string;
  formatValue?: (value: number) => string;
};

const DoughnutCard = ({
  title,
  segments,
  loading,
  emptyMessage = "No data yet",
  formatValue
}: DoughnutCardProps) => {
  const theme = useChartTheme();

  const data = useMemo(
    () => ({
      labels: segments.map(segment => segment.label),
      datasets: [
        {
          data: segments.map(segment => segment.value),
          backgroundColor: segments.map(
            (_, index) => theme.categorical[index % theme.categorical.length]
          ),
          borderColor: theme.surface,
          borderWidth: 2
        }
      ]
    }),
    [segments, theme.categorical, theme.surface]
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: "62%",
      plugins: {
        legend: {
          position: "right" as const,
          labels: {color: theme.textColor, boxWidth: 12, usePointStyle: true, font: {size: 11}}
        },
        tooltip: {
          callbacks: formatValue
            ? {
                label: (ctx: any) => ` ${ctx.label}: ${formatValue(ctx.parsed)}`
              }
            : undefined
        }
      }
    }),
    [theme.textColor, formatValue]
  );

  const isEmpty = !loading && segments.length === 0;

  return (
    <FlexElement
      className={styles.doughnutCard}
      direction="vertical"
      gap={0}
      dimensionX="fill"
      dimensionY="fill"
    >
      <Text className={styles.title}>{title}</Text>
      <div className={styles.body}>
        {loading && <Text className={styles.stateText}>Loading…</Text>}
        {isEmpty && <Text className={styles.stateText}>{emptyMessage}</Text>}
        {!loading && !isEmpty && (
          <Chart type="doughnut" data={data} options={options as any} />
        )}
      </div>
    </FlexElement>
  );
};

export default memo(DoughnutCard);
