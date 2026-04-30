import {convertQuickDateToRange} from "./storage";
import {STORAGE_CREATED_AT_PRESETS} from "./storageFilter";

export const PROFILER_TIMESTAMP_PRESETS = STORAGE_CREATED_AT_PRESETS;

export const OP_OPTIONS = [
  {label: "All", value: ""},
  {label: "Insert", value: "insert"},
  {label: "Query", value: "query"},
  {label: "Update", value: "update"},
  {label: "Remove", value: "remove"},
  {label: "Command", value: "command"},
  {label: "Count", value: "count"},
  {label: "Get More", value: "getMore"},
];

export type ProfilerFilterValues = {
  op: string[];
  millis: {min: number | null; max: number | null};
  keysExamined: {min: number | null; max: number | null};
  docsExamined: {min: number | null; max: number | null};
  planSummary: string;
  client: string;
  ts: {quickdate: string | null; from: Date | null; to: Date | null};
};

export function createProfilerFilterDefaultValues(): ProfilerFilterValues {
  return {
    op: [],
    millis: {min: null, max: null},
    keysExamined: {min: null, max: null},
    docsExamined: {min: null, max: null},
    planSummary: "",
    client: "",
    ts: {quickdate: null, from: null, to: null},
  };
}

export function isDefaultProfilerFilter(filter: ProfilerFilterValues): boolean {
  return (
    filter.op.length === 0 &&
    filter.millis.min === null &&
    filter.millis.max === null &&
    filter.keysExamined.min === null &&
    filter.keysExamined.max === null &&
    filter.docsExamined.min === null &&
    filter.docsExamined.max === null &&
    filter.planSummary === "" &&
    filter.client === "" &&
    filter.ts.quickdate === null &&
    filter.ts.from === null &&
    filter.ts.to === null
  );
}

export function buildProfilerFilterQuery(
  filter: ProfilerFilterValues
): Record<string, unknown> | undefined {
  const query: Record<string, unknown> = {};

  if (filter.op.length > 0) {
    query.op = {$in: filter.op};
  }

  if (filter.millis.min !== null || filter.millis.max !== null) {
    const millis: Record<string, number> = {};
    if (filter.millis.min !== null) millis.$gte = filter.millis.min;
    if (filter.millis.max !== null) millis.$lte = filter.millis.max;
    query.millis = millis;
  }

  if (filter.keysExamined.min !== null || filter.keysExamined.max !== null) {
    const ke: Record<string, number> = {};
    if (filter.keysExamined.min !== null) ke.$gte = filter.keysExamined.min;
    if (filter.keysExamined.max !== null) ke.$lte = filter.keysExamined.max;
    query.keysExamined = ke;
  }

  if (filter.docsExamined.min !== null || filter.docsExamined.max !== null) {
    const de: Record<string, number> = {};
    if (filter.docsExamined.min !== null) de.$gte = filter.docsExamined.min;
    if (filter.docsExamined.max !== null) de.$lte = filter.docsExamined.max;
    query.docsExamined = de;
  }

  if (filter.planSummary.trim()) {
    query.planSummary = {$regex: filter.planSummary.trim(), $options: "i"};
  }

  if (filter.client.trim()) {
    query.client = {$regex: filter.client.trim(), $options: "i"};
  }

  const tsRange = filter.ts.quickdate
    ? convertQuickDateToRange(filter.ts.quickdate)
    : {from: filter.ts.from, to: filter.ts.to};

  if (tsRange.from || tsRange.to) {
    const ts: Record<string, string> = {};
    if (tsRange.from) ts.$gte = tsRange.from.toISOString();
    if (tsRange.to) ts.$lte = tsRange.to.toISOString();
    query.ts = ts;
  }

  return Object.keys(query).length > 0 ? query : undefined;
}
