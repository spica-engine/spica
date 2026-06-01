import type {FunctionLog} from "../store/api/functionApi";

export type DateRange = {begin: Date; end: Date};
export type BrushRange = {startRatio: number; endRatio: number};
export type DragMode = "start" | "end" | "range" | null;

export type TimeBucket = {
  index: number;
  ratio: number;
  count: number;
};

export const DEFAULT_BUCKET_COUNT = 48;
export const MIN_BRUSH_SIZE = 0.04;
export const DEFAULT_BRUSH_RANGE: BrushRange = {startRatio: 0, endRatio: 1};

export function getDefaultRange(): DateRange {
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const begin = new Date();
  begin.setHours(0, 0, 0, 0);

  return {begin, end};
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function formatDateTimeLocal(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatToolbarDate(date: Date) {
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatTimelineLabel(date: Date, withDate: boolean) {
  return date.toLocaleString("en-US", {
    month: withDate ? "short" : undefined,
    day: withDate ? "numeric" : undefined,
    hour: "numeric",
    minute: "2-digit",
  });
}

export function getLogDate(log: FunctionLog) {
  if (log.created_at) {
    const parsed = new Date(log.created_at);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date(Number.parseInt(log._id.slice(0, 8), 16) * 1000);
}

export function formatRowTimestamp(log: FunctionLog) {
  return getLogDate(log).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function clampRatio(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function clampBrush(startRatio: number, endRatio: number): BrushRange {
  const start = clampRatio(startRatio);
  const end = clampRatio(endRatio);

  if (end - start < MIN_BRUSH_SIZE) {
    if (start + MIN_BRUSH_SIZE <= 1) {
      return {startRatio: start, endRatio: start + MIN_BRUSH_SIZE};
    }

    return {startRatio: Math.max(0, end - MIN_BRUSH_SIZE), endRatio: end};
  }

  return {startRatio: start, endRatio: end};
}

export function buildTimeBuckets(logs: FunctionLog[], range: DateRange): TimeBucket[] {
  const beginTime = range.begin.getTime();
  const endTime = Math.max(range.end.getTime(), beginTime + 1);
  const bucketLength = (endTime - beginTime) / DEFAULT_BUCKET_COUNT;
  const counts = new Array<number>(DEFAULT_BUCKET_COUNT).fill(0);

  logs.forEach(log => {
    const time = getLogDate(log).getTime();

    if (time < beginTime || time > endTime) {
      return;
    }

    const index = Math.min(
      DEFAULT_BUCKET_COUNT - 1,
      Math.max(0, Math.floor((time - beginTime) / bucketLength))
    );

    counts[index] += 1;
  });

  return counts.map((count, index) => ({
    index,
    ratio: index / Math.max(DEFAULT_BUCKET_COUNT - 1, 1),
    count,
  }));
}

export function isSameDayRange(left: DateRange, right: DateRange) {
  return left.begin.getTime() === right.begin.getTime() && left.end.getTime() === right.end.getTime();
}