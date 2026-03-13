import {memo, useMemo} from "react";
import {Chart, FlexElement} from "oziko-ui-kit";
import type {Plugin} from "chart.js";
import type {FunctionLog} from "../../store/api/functionApi";
import styles from "./FunctionLogPage.module.scss";

type FunctionLogChartProps = {
  logs: FunctionLog[];
  begin: Date;
  end: Date;
};

function buildChartData(logs: FunctionLog[], begin: Date, end: Date) {
  const rangeMs = end.getTime() - begin.getTime();
  const oneDay = 24 * 60 * 60 * 1000;
  const useHourly = rangeMs <= 2 * oneDay;

  const bucketMap = new Map<string, number>();

  if (useHourly) {
    const start = new Date(begin);
    start.setMinutes(0, 0, 0);
    for (let t = start.getTime(); t <= end.getTime(); t += 60 * 60 * 1000) {
      const d = new Date(t);
      const key = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:00`;
      bucketMap.set(key, 0);
    }
  } else {
    const start = new Date(begin);
    start.setHours(0, 0, 0, 0);
    for (let t = start.getTime(); t <= end.getTime(); t += oneDay) {
      const d = new Date(t);
      const key = `${d.getMonth() + 1}/${d.getDate()}`;
      bucketMap.set(key, 0);
    }
  }

  for (const log of logs) {
    const ts = Number.parseInt(log._id.substring(0, 8), 16) * 1000;
    const d = new Date(ts);
    const key = useHourly
      ? `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:00`
      : `${d.getMonth() + 1}/${d.getDate()}`;

    if (bucketMap.has(key)) {
      bucketMap.set(key, (bucketMap.get(key) ?? 0) + 1);
    }
  }

  const labels = Array.from(bucketMap.keys());
  const values = Array.from(bucketMap.values());

  return {
    labels,
    datasets: [
      {
        label: "Log count",
        data: values,
        backgroundColor: "rgba(66, 165, 245, 0.5)",
        borderColor: "rgba(66, 165, 245, 0.8)",
        borderWidth: 1,
        borderRadius: 3,
        barPercentage: 0.5,
        categoryPercentage: 0.6,
      },
    ],
  };
}

const chartOptions = {
    
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {display: false},
    customCanvasBackgroundColor:{
        color: "#ffffff",
    },
    tooltip: {
      backgroundColor: "#333",
      titleFont: {size: 12},
      bodyFont: {size: 12},
      padding: 8,
      cornerRadius: 4,
    },
  },
  scales: {
    x: {
      grid: {display: false},
      ticks: {font: {size: 11}, color: "#999", maxRotation: 45},
    },
    y: {
      beginAtZero: true,
      grid: {color: "rgba(0,0,0,0.05)"},
      ticks: {
        font: {size: 11},
        color: "#999",
        stepSize: 1,
        precision: 0,
      },
    },
  },
} as const;



const FunctionLogChart = ({logs, begin, end}: FunctionLogChartProps) => {
  const data = useMemo(() => buildChartData(logs, begin, end), [logs, begin, end]);

  return (
    <FlexElement dimensionX="fill" className={styles.chartSection}>
      <Chart type="bar" data={data} options={chartOptions as any} className={styles.chartCanvas} />
    </FlexElement>
  );
};

export default memo(FunctionLogChart);
