import {useMemo} from "react";
import {useGetBucketsQuery} from "../../store/api/bucketApi";
import {useGetUsersQuery} from "../../store/api/userApi";
import {
  useGetLivenessQuery,
  useGetReadinessQuery,
  useGetStatusesQuery,
  type StatusModule,
  type StatusSection
} from "../../store/api/statusApi";
import {formatBytes, formatCount} from "../../components/molecules/chart-kit/chartTheme";
import type {ChartPanelStatus} from "../../components/molecules/chart-panel/ChartPanel";

// A resource is flagged for attention once usage reaches this share of its cap.
const ATTENTION_THRESHOLD = 0.9;
const BUCKET_COLLECTION_PREFIX = "bucket_";

export type HealthState = "ok" | "down" | "unknown";

export type StatTile = {value: number; displayValue?: string; loading: boolean};

export type LimitGauge = {
  key: string;
  label: string;
  current: number;
  limit: number;
  unit: string;
  percent: number;
  centerLabel: string;
  unlimited: boolean;
};

export type ModuleHealth = {module: string; attention: boolean; detail: string};

export type DashboardData = {
  tiles: {
    buckets: StatTile;
    documents: StatTile;
    functions: StatTile;
    users: StatTile;
    storage: StatTile;
  };
  limits: {
    modules: LimitGauge[];
    buckets: LimitGauge[];
    status: ChartPanelStatus;
  };
  health: {
    live: HealthState;
    ready: HealthState;
    modules: ModuleHealth[];
    status: ChartPanelStatus;
  };
};

type Metric = {current: number; limit?: number; unit: string};

// The backend exposes free-form section shapes (e.g. the function scheduler's
// `workers`), so every read is narrowed defensively — a missing/odd section can
// never crash the dashboard the way an earlier shape assumption did.
function asMetric(section: StatusSection | undefined): Metric {
  const s = section as any;
  return {
    current: typeof s?.current === "number" ? s.current : 0,
    limit: typeof s?.limit === "number" ? s.limit : undefined,
    unit: typeof s?.unit === "string" ? s.unit : "count"
  };
}

const formatMetric = (value: number, unit: string): string =>
  unit === "mb" ? formatBytes(value * 1_000_000) : formatCount(value);

function toGauge(key: string, label: string, section: StatusSection | undefined): LimitGauge {
  const metric = asMetric(section);
  const hasLimit = typeof metric.limit === "number" && metric.limit > 0;
  const limit = metric.limit ?? 0;
  const percent = hasLimit ? Math.round((metric.current / limit) * 100) : 0;
  return {
    key,
    label,
    current: metric.current,
    limit,
    unit: metric.unit,
    percent,
    unlimited: !hasLimit,
    centerLabel: hasLimit
      ? `${formatMetric(metric.current, metric.unit)}/${formatMetric(limit, metric.unit)}`
      : formatMetric(metric.current, metric.unit)
  };
}

function toStatus(isLoading: boolean, isError: boolean, isEmpty: boolean): ChartPanelStatus {
  if (isError) return "error";
  if (isLoading) return "loading";
  if (isEmpty) return "empty";
  return "ready";
}

function toHealthState(isLoading: boolean, isError: boolean, status?: string): HealthState {
  if (isLoading) return "unknown";
  if (isError) return "down";
  return status === "ok" ? "ok" : "down";
}

export function useDashboardData(): DashboardData {
  const statusesQuery = useGetStatusesQuery();
  const bucketsQuery = useGetBucketsQuery();
  const usersQuery = useGetUsersQuery({paginate: true, limit: 1});
  const livenessQuery = useGetLivenessQuery();
  const readinessQuery = useGetReadinessQuery();

  const byModule = useMemo(() => {
    const map = new Map<string, StatusModule>();
    for (const entry of statusesQuery.data ?? []) map.set(entry.module, entry);
    return map;
  }, [statusesQuery.data]);

  const bucketTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const bucket of bucketsQuery.data ?? []) map.set(bucket._id, bucket.title);
    return map;
  }, [bucketsQuery.data]);

  const statusesLoading = statusesQuery.isLoading;

  const tiles = useMemo(() => {
    const bucketMod = byModule.get("bucket");
    const fnMod = byModule.get("function");
    const storageMod = byModule.get("storage");

    const bucketsCount = asMetric(bucketMod?.status?.buckets).current;
    const documentsCount = asMetric(bucketMod?.status?.bucketData).current;
    const functionsCount = asMetric(fnMod?.status?.functions).current;
    const storageMb = asMetric(storageMod?.status?.size).current;
    const storageBytes = storageMb * 1_000_000;

    return {
      buckets: {value: bucketsCount, loading: statusesLoading},
      documents: {value: documentsCount, loading: statusesLoading},
      functions: {value: functionsCount, loading: statusesLoading},
      users: {
        value: usersQuery.data?.meta?.total ?? usersQuery.data?.data?.length ?? 0,
        loading: usersQuery.isLoading
      },
      storage: {
        value: storageBytes,
        displayValue: formatBytes(storageBytes),
        loading: statusesLoading
      }
    };
  }, [byModule, statusesLoading, usersQuery.data, usersQuery.isLoading]);

  const moduleGauges = useMemo<LimitGauge[]>(() => {
    const bucketMod = byModule.get("bucket");
    const fnMod = byModule.get("function");
    const storageMod = byModule.get("storage");
    const apiMod = byModule.get("api");

    return [
      toGauge("api-requests", "API requests", apiMod?.status?.request),
      toGauge("bucket-documents", "Bucket documents", bucketMod?.status?.bucketData),
      toGauge("storage-size", "Storage size", storageMod?.status?.size),
      toGauge("functions", "Functions", fnMod?.status?.functions)
    ];
  }, [byModule]);

  const bucketGauges = useMemo<LimitGauge[]>(() => {
    const status = byModule.get("bucket")?.status ?? {};
    const rows: LimitGauge[] = [];
    for (const [key, section] of Object.entries(status)) {
      if (!key.startsWith(BUCKET_COLLECTION_PREFIX)) continue;
      const id = key.slice(BUCKET_COLLECTION_PREFIX.length);
      const label = bucketTitleById.get(id) ?? id.slice(-6);
      rows.push(toGauge(key, label, section));
    }

    // Only surface buckets that actually carry a configured entry limit; a bucket
    // with no/zero limit has nothing meaningful to gauge, so it is dropped and the
    // subsection hides itself when none remain.
    return rows.filter(row => !row.unlimited).sort((a, b) => b.percent - a.percent);
  }, [byModule, bucketTitleById]);

  const moduleHealth = useMemo<ModuleHealth[]>(() => {
    return (statusesQuery.data ?? []).map(entry => {
      let attention = false;
      for (const section of Object.values(entry.status ?? {})) {
        const metric = asMetric(section);
        if (metric.limit && metric.limit > 0 && metric.current / metric.limit >= ATTENTION_THRESHOLD) {
          attention = true;
        }
      }
      return {module: entry.module, attention, detail: attention ? "Near limit" : "Healthy"};
    });
  }, [statusesQuery.data]);

  return {
    tiles,
    limits: {
      modules: moduleGauges,
      buckets: bucketGauges,
      status: toStatus(
        statusesQuery.isLoading,
        statusesQuery.isError,
        moduleGauges.length === 0 && bucketGauges.length === 0
      )
    },
    health: {
      live: toHealthState(livenessQuery.isLoading, livenessQuery.isError, livenessQuery.data?.status),
      ready: toHealthState(
        readinessQuery.isLoading,
        readinessQuery.isError,
        readinessQuery.data?.status
      ),
      modules: moduleHealth,
      status: toStatus(
        statusesQuery.isLoading,
        statusesQuery.isError,
        (statusesQuery.data?.length ?? 0) === 0
      )
    }
  };
}
