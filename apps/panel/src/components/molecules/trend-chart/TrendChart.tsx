import {memo, useMemo} from "react";
import styles from "./TrendChart.module.scss";
import {Chart} from "oziko-ui-kit";
import {buildAxisOptions, useChartTheme} from "../chart-kit/chartTheme";

export type TrendSeries = {label: string; data: number[]; color?: string};

type TrendChartProps = {
  kind: "line" | "bar";
  labels: string[];
  series: TrendSeries[];
  horizontal?: boolean;
  stacked?: boolean;
  showLegend?: boolean;
  fill?: boolean;
};

const TrendChart = ({
  kind,
  labels,
  series,
  horizontal = false,
  stacked = false,
  showLegend = true,
  fill = false
}: TrendChartProps) => {
  const theme = useChartTheme();

  const data = useMemo(
    () => ({
      labels,
      datasets: series.map((entry, index) => {
        const color = entry.color ?? theme.categorical[index % theme.categorical.length];
        if (kind === "line") {
          return {
            label: entry.label,
            data: entry.data,
            borderColor: color,
            backgroundColor: fill ? `${color}22` : color,
            borderWidth: 2,
            fill,
            tension: 0.35,
            pointRadius: 2,
            pointHoverRadius: 4
          };
        }
        return {
          label: entry.label,
          data: entry.data,
          backgroundColor: color,
          borderRadius: 4,
          borderWidth: 0,
          maxBarThickness: 34
        };
      })
    }),
    [labels, series, kind, fill, theme.categorical]
  );

  const options = useMemo(() => {
    const base = buildAxisOptions(theme) as any;
    base.plugins.legend.display = showLegend;
    if (horizontal) base.indexAxis = "y";
    if (stacked) {
      base.scales.x.stacked = true;
      base.scales.y.stacked = true;
    }
    return base;
  }, [theme, showLegend, horizontal, stacked]);

  return (
    <div className={styles.trendChart}>
      <Chart type={kind} data={data} options={options} />
    </div>
  );
};

export default memo(TrendChart);
