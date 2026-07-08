import {useEffect, useMemo, useRef, useState} from "react";
import {useDispatch} from "react-redux";
import {statusApi} from "../../store/api/statusApi";
import type {AppDispatch} from "../../store";
import type {ChartPanelStatus} from "../../components/molecules/chart-panel/ChartPanel";

export type TrafficRange = {begin: string; end: string};

export type TrafficPoint = {label: string; requests: number};

export type TrafficTimeline = {
  points: TrafficPoint[];
  status: ChartPanelStatus;
  intervalLabel: string;
};

// The hosted status API only returns an AGGREGATE `{request, uploaded, downloaded}`
// for a given window — it has no per-interval series and we cannot add backend
// bucketing. So the series is synthesised client-side: the range is split into N
// intervals and ONE `status/api` request is fired per interval. That means the
// point count is also the request count, so it is capped hard to keep the fan-out
// bounded (worst case MAX_POINTS parallel requests per range change; RTK-cached).
const TARGET_POINTS = 30;
const MAX_POINTS = 48;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const INTERVAL_STEPS: {ms: number; label: string}[] = [
  {ms: MINUTE, label: "per minute"},
  {ms: 2 * MINUTE, label: "per 2 minutes"},
  {ms: 5 * MINUTE, label: "per 5 minutes"},
  {ms: 15 * MINUTE, label: "per 15 minutes"},
  {ms: 30 * MINUTE, label: "per 30 minutes"},
  {ms: HOUR, label: "per hour"},
  {ms: 3 * HOUR, label: "per 3 hours"},
  {ms: 6 * HOUR, label: "per 6 hours"},
  {ms: 12 * HOUR, label: "per 12 hours"},
  {ms: DAY, label: "per day"}
];

function pickInterval(rangeMs: number): {ms: number; label: string} {
  const ideal = rangeMs / TARGET_POINTS;
  for (const step of INTERVAL_STEPS) {
    if (step.ms >= ideal && rangeMs / step.ms <= MAX_POINTS) return step;
  }
  return INTERVAL_STEPS[INTERVAL_STEPS.length - 1];
}

function formatTick(startMs: number, intervalMs: number): string {
  const date = new Date(startMs);
  if (intervalMs >= DAY) {
    return date.toLocaleDateString(undefined, {month: "short", day: "numeric"});
  }
  return date.toLocaleTimeString(undefined, {hour: "2-digit", minute: "2-digit"});
}

function readRequestCount(result: unknown): number {
  const current = (result as any)?.status?.request?.current;
  return typeof current === "number" ? current : 0;
}

export function useTrafficTimeline(range: TrafficRange): TrafficTimeline {
  const dispatch = useDispatch<AppDispatch>();

  const {list, intervalLabel} = useMemo(() => {
    const beginMs = new Date(range.begin).getTime();
    const endMs = new Date(range.end).getTime();
    if (!Number.isFinite(beginMs) || !Number.isFinite(endMs) || endMs <= beginMs) {
      return {list: [] as {begin: string; end: string; label: string}[], intervalLabel: ""};
    }
    const {ms: intervalMs, label} = pickInterval(endMs - beginMs);
    const buckets: {begin: string; end: string; label: string}[] = [];
    for (let start = beginMs; start < endMs; start += intervalMs) {
      const bucketEnd = Math.min(start + intervalMs, endMs);
      buckets.push({
        begin: new Date(start).toISOString(),
        end: new Date(bucketEnd).toISOString(),
        label: formatTick(start, intervalMs)
      });
    }
    return {list: buckets.slice(-MAX_POINTS), intervalLabel: label};
  }, [range.begin, range.end]);

  const [state, setState] = useState<{points: TrafficPoint[]; status: ChartPanelStatus}>({
    points: [],
    status: "loading"
  });

  // Guards against a stale in-flight fan-out overwriting the results of a newer
  // range selection (the user can flip presets faster than requests resolve).
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!list.length) {
      setState({points: [], status: "empty"});
      return;
    }

    const requestId = ++requestIdRef.current;
    setState(prev => ({points: prev.points, status: "loading"}));

    const subscriptions = list.map(bucket =>
      dispatch(
        statusApi.endpoints.getModuleStatus.initiate({
          module: "api",
          begin: bucket.begin,
          end: bucket.end
        })
      )
    );

    Promise.all(subscriptions.map(sub => sub.unwrap().catch(() => null))).then(results => {
      if (requestId !== requestIdRef.current) return;
      const points = results.map((result, index) => ({
        label: list[index].label,
        requests: readRequestCount(result)
      }));
      const allFailed = results.every(result => result === null);
      const total = points.reduce((sum, point) => sum + point.requests, 0);
      setState({
        points,
        status: allFailed ? "error" : total === 0 ? "empty" : "ready"
      });
    });

    return () => subscriptions.forEach(sub => sub.unsubscribe());
  }, [list, dispatch]);

  return {points: state.points, status: state.status, intervalLabel};
}
