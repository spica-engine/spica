import {memo, useMemo} from "react";
import styles from "./GaugeCard.module.scss";
import {Chart, FlexElement, Text} from "oziko-ui-kit";
import {useChartTheme} from "../chart-kit/chartTheme";

type GaugeCardProps = {
  title: string;
  value: number;
  max: number;
  centerLabel: string;
  caption?: string;
  color?: string;
  loading?: boolean;
  // When the underlying resource has no configured cap the ring renders as an
  // empty neutral track and the percentage is suppressed, so a "no limit"
  // metric is never misread as either full or empty usage.
  unlimited?: boolean;
};

const GaugeCard = ({
  title,
  value,
  max,
  centerLabel,
  caption,
  color,
  loading,
  unlimited = false
}: GaugeCardProps) => {
  const theme = useChartTheme();
  const arcColor = color ?? theme.accent;

  const {data, percent} = useMemo(() => {
    const safeMax = max > 0 ? max : 1;
    const used = unlimited ? 0 : Math.min(Math.max(value, 0), safeMax);
    const remaining = Math.max(safeMax - used, 0);
    const pct = Math.round((value / safeMax) * 100);
    return {
      percent: pct,
      data: {
        labels: ["Used", "Remaining"],
        datasets: [
          {
            data: [used, remaining],
            backgroundColor: [arcColor, theme.track],
            borderWidth: 0,
            circumference: 270,
            rotation: 225
          }
        ]
      }
    };
  }, [value, max, arcColor, theme.track, unlimited]);

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: "74%",
      plugins: {legend: {display: false}, tooltip: {enabled: false}},
      animation: false as const
    }),
    []
  );

  return (
    <FlexElement
      className={styles.gaugeCard}
      direction="vertical"
      gap={0}
      dimensionX="fill"
      dimensionY="fill"
    >
      <Text className={styles.title}>{title}</Text>

      <div className={styles.gaugeWrap}>
        {!loading && <Chart type="doughnut" data={data} options={options as any} />}
        <div className={styles.center}>
          <Text className={styles.centerValue}>{loading ? "—" : centerLabel}</Text>
          {!loading && !unlimited && <Text className={styles.centerPercent}>{percent}%</Text>}
          {!loading && unlimited && <Text className={styles.centerPercent}>no limit</Text>}
        </div>
      </div>

      {caption && <Text className={styles.caption}>{caption}</Text>}
    </FlexElement>
  );
};

export default memo(GaugeCard);
