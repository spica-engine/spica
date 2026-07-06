import {memo, useCallback, useMemo, useState} from "react";
import styles from "./Home.module.scss";
import {FlexElement, Text} from "oziko-ui-kit";
import "oziko-ui-kit/dist/index.css";
import Quicklinks from "../../components/molecules/quicklinks/Quicklinks";
import WelcomeText from "../../components/atoms/welcome-text/WelcomeText";
import StatSparklineTile from "../../components/molecules/stat-sparkline-tile/StatSparklineTile";
import ChartPanel, {type ChartPanelStatus} from "../../components/molecules/chart-panel/ChartPanel";
import TrendChart from "../../components/molecules/trend-chart/TrendChart";
import GaugeCard from "../../components/molecules/gauge-card/GaugeCard";
import DateRangePicker, {
  type DateRange,
  type RangePreset
} from "../../components/molecules/date-range-picker/DateRangePicker";
import {CATEGORICAL_PALETTE, formatBytes, formatCount} from "../../components/molecules/chart-kit/chartTheme";
import {useDashboardData, type HealthState, type LimitGauge} from "./useDashboardData";
import {useTrafficTimeline} from "./useTrafficTimeline";
import {useGetModuleStatusQuery} from "../../store/api/statusApi";

const currentRelease = (import.meta.env.VITE_APP_RELEASE as string) || "0.0.0-dev";

const DANGER = "#ef4444";

const gaugeColor = (gauge: LimitGauge, index: number): string =>
  !gauge.unlimited && gauge.percent >= 90
    ? DANGER
    : CATEGORICAL_PALETTE[index % CATEGORICAL_PALETTE.length];

const HEALTH_LABEL: Record<HealthState, string> = {
  ok: "Healthy",
  down: "Unavailable",
  unknown: "Checking…"
};

const HealthPill = ({label, state}: {label: string; state: HealthState}) => (
  <div className={`${styles.pill} ${styles[state]}`}>
    <span className={styles.pillDot} />
    <Text className={styles.pillLabel}>{label}</Text>
    <Text className={styles.pillState}>{HEALTH_LABEL[state]}</Text>
  </div>
);

const DEFAULT_RANGE = (): DateRange => {
  const end = new Date();
  const begin = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  return {begin: begin.toISOString(), end: end.toISOString()};
};

const readMetricCurrent = (section: unknown): number => {
  const current = (section as any)?.current;
  return typeof current === "number" ? current : 0;
};

const Home = () => {
  const {tiles, limits, health} = useDashboardData();

  const [rangePreset, setRangePreset] = useState<RangePreset>("24h");
  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);

  const handleRangeChange = useCallback((preset: RangePreset, next: DateRange) => {
    setRangePreset(preset);
    setRange(next);
  }, []);

  const timeline = useTrafficTimeline(range);

  const timelineChart = useMemo(
    () => ({
      labels: timeline.points.map(point => point.label),
      data: timeline.points.map(point => point.requests)
    }),
    [timeline.points]
  );

  const totalsQuery = useGetModuleStatusQuery({
    module: "api",
    begin: range.begin,
    end: range.end
  });

  const totals = useMemo(() => {
    const status = (totalsQuery.data?.status ?? {}) as Record<string, unknown>;
    return {
      requests: readMetricCurrent(status.request),
      uploadedMb: readMetricCurrent(status.uploaded),
      downloadedMb: readMetricCurrent(status.downloaded)
    };
  }, [totalsQuery.data]);

  const totalsStatus: ChartPanelStatus = totalsQuery.isError
    ? "error"
    : totalsQuery.isLoading
      ? "loading"
      : "ready";

  const showBucketPanel = limits.status === "loading" || limits.buckets.length > 0;
  const healthPanelStatus = health.status === "loading" ? "loading" : "ready";

  return (
    <div className={styles.home}>
      <FlexElement dimensionX="fill" direction="vertical" gap={16} className={styles.content}>
        <WelcomeText />
        <FlexElement dimensionX="fill">
          <Quicklinks currentVersion={currentRelease} />
        </FlexElement>

        <Text className={styles.sectionTitle}>Resource overview</Text>
        <div className={styles.tiles}>
          <StatSparklineTile
            icon="bucket"
            label="Buckets"
            value={tiles.buckets.value}
            accent={CATEGORICAL_PALETTE[0]}
            loading={tiles.buckets.loading}
          />
          <StatSparklineTile
            icon="article"
            label="Documents"
            value={tiles.documents.value}
            accent={CATEGORICAL_PALETTE[2]}
            loading={tiles.documents.loading}
          />
          <StatSparklineTile
            icon="function"
            label="Functions"
            value={tiles.functions.value}
            accent={CATEGORICAL_PALETTE[4]}
            loading={tiles.functions.loading}
          />
          <StatSparklineTile
            icon="users"
            label="Users"
            value={tiles.users.value}
            accent={CATEGORICAL_PALETTE[3]}
            loading={tiles.users.loading}
          />
          <StatSparklineTile
            icon="storage"
            label="Storage used"
            value={tiles.storage.value}
            displayValue={tiles.storage.displayValue}
            accent={CATEGORICAL_PALETTE[6]}
            loading={tiles.storage.loading}
          />
        </div>

        <Text className={styles.sectionTitle}>Limits</Text>
        <div className={styles.panels}>
          <ChartPanel
            title="Usage limits"
            subtitle="Current usage vs configured limits"
            status={limits.status}
            emptyMessage="No modules reporting status"
          >
            <div className={styles.gauges}>
              {limits.modules.map((gauge, index) => (
                <GaugeCard
                  key={gauge.key}
                  title={gauge.label}
                  value={gauge.current}
                  max={gauge.limit}
                  centerLabel={gauge.centerLabel}
                  color={gaugeColor(gauge, index)}
                  unlimited={gauge.unlimited}
                />
              ))}
            </div>
          </ChartPanel>

          {showBucketPanel && (
            <ChartPanel
              title="Bucket entry limits"
              subtitle="Documents vs limit per bucket"
              status={limits.status}
              emptyMessage="No buckets to report yet"
            >
              <div className={styles.gauges}>
                {limits.buckets.map((gauge, index) => (
                  <GaugeCard
                    key={gauge.key}
                    title={gauge.label}
                    value={gauge.current}
                    max={gauge.limit}
                    centerLabel={gauge.centerLabel}
                    caption="documents"
                    color={gaugeColor(gauge, index)}
                    unlimited={gauge.unlimited}
                  />
                ))}
              </div>
            </ChartPanel>
          )}
        </div>

        <Text className={styles.sectionTitle}>Traffic</Text>
        <div className={styles.trafficControls}>
          <DateRangePicker preset={rangePreset} range={range} onChange={handleRangeChange} />
        </div>
        <div className={styles.panels}>
          <ChartPanel
            title="Requests over time"
            subtitle={timeline.intervalLabel ? `Requests ${timeline.intervalLabel}` : "Requests"}
            status={timeline.status}
            emptyMessage="No API requests in the selected range"
          >
            <TrendChart
              kind="line"
              fill
              showLegend={false}
              labels={timelineChart.labels}
              series={[
                {
                  label: "Requests",
                  data: timelineChart.data,
                  color: CATEGORICAL_PALETTE[0]
                }
              ]}
            />
          </ChartPanel>

          <ChartPanel
            title="Traffic totals"
            subtitle="Aggregate for the selected range"
            status={totalsStatus}
          >
            <div className={styles.stats}>
              <div className={styles.statRow}>
                <Text className={styles.statLabel}>Requests</Text>
                <Text className={styles.statValue}>{formatCount(totals.requests)}</Text>
              </div>
              <div className={styles.statRow}>
                <Text className={styles.statLabel}>Uploaded</Text>
                <Text className={styles.statValue}>{formatBytes(totals.uploadedMb * 1_000_000)}</Text>
              </div>
              <div className={styles.statRow}>
                <Text className={styles.statLabel}>Downloaded</Text>
                <Text className={styles.statValue}>
                  {formatBytes(totals.downloadedMb * 1_000_000)}
                </Text>
              </div>
            </div>
          </ChartPanel>
        </div>

        <Text className={styles.sectionTitle}>Status</Text>
        <div className={styles.panels}>
          <ChartPanel
            title="System health"
            subtitle="Liveness, readiness & per-module usage"
            status={healthPanelStatus}
          >
            <div className={styles.health}>
              <div className={styles.pills}>
                <HealthPill label="Live" state={health.live} />
                <HealthPill label="Ready" state={health.ready} />
              </div>

              {health.modules.length ? (
                <div className={styles.moduleList}>
                  {health.modules.map(entry => (
                    <div key={entry.module} className={styles.moduleRow}>
                      <Text className={styles.moduleName}>{entry.module}</Text>
                      <span
                        className={`${styles.badge} ${
                          entry.attention ? styles.badgeAttention : styles.badgeHealthy
                        }`}
                      >
                        {entry.detail}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <Text className={styles.note}>No modules reporting status.</Text>
              )}
            </div>
          </ChartPanel>
        </div>
      </FlexElement>
    </div>
  );
};

export default memo(Home);
