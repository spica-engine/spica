import type {ChartData} from "chart.js";

/**
 * Checks whether the API response is already in Chart.js format
 * (has `labels` and/or `datasets` at the top level).
 */
function isChartJsFormat(response: any): boolean {
  return response && Array.isArray(response.datasets);
}

/**
 * If the API response is already Chart.js format (`{ labels, datasets }`),
 * return it directly. Otherwise transform a raw row-based response
 * (`{ data: [...rows], displayedColumns }`) into Chart.js format.
 *
 * Transformation strategy:
 *  - Pick the first date-like or string column as x-axis labels.
 *  - Collect all numeric columns as individual datasets.
 *  - Boolean columns are cast to 0 / 1 so they can be charted.
 */
export function normalizeChartData(response: any): ChartData {
  if (!response) return {labels: [], datasets: []};

  // Already Chart.js format
  if (isChartJsFormat(response)) {
    return {
      labels: response.labels ?? [],
      datasets: response.datasets,
    };
  }

  const rows: Record<string, any>[] = Array.isArray(response.data)
    ? response.data
    : Array.isArray(response)
      ? response
      : [];

  if (rows.length === 0) return {labels: [], datasets: []};

  const allKeys = Object.keys(rows[0]);

  // Classify columns
  const labelKey = findLabelKey(rows, allKeys);
  const numericKeys = allKeys.filter(
    (k) => k !== labelKey && rows.some((r) => typeof r[k] === "number" || typeof r[k] === "boolean")
  );

  const labels = rows.map((r) => formatLabel(r[labelKey]));

  const datasets = numericKeys.map((key, idx) => ({
    label: prettifyKey(key),
    data: rows.map((r) => {
      const v = r[key];
      if (typeof v === "boolean") return v ? 1 : 0;
      return typeof v === "number" ? v : 0;
    }),
    borderColor: COLORS[idx % COLORS.length],
    backgroundColor: COLORS[idx % COLORS.length] + "66",
  }));

  return {labels, datasets};
}

/**
 * Normalise a table-type API response.
 * Supports both `columns` and `displayedColumns` property names.
 */
export function normalizeTableData(response: any): {data: any[]; columns: string[]} {
  if (!response) return {data: [], columns: []};

  const data: any[] = Array.isArray(response.data)
    ? response.data
    : Array.isArray(response)
      ? response
      : [];

  const columns: string[] =
    response.displayedColumns ??
    response.columns ??
    (data.length > 0 ? Object.keys(data[0]) : []);

  return {data, columns};
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Pick the best column to use as x-axis labels (prefer date, then string). */
function findLabelKey(rows: Record<string, any>[], keys: string[]): string {
  // Prefer a column whose name hints at time
  const timeHints = ["date", "time", "created", "updated", "start", "end", "timestamp"];
  const dateKey = keys.find(
    (k) =>
      timeHints.some((h) => k.toLowerCase().includes(h)) &&
      typeof rows[0][k] === "string"
  );
  if (dateKey) return dateKey;

  // Prefer first string column that looks like an identifier
  const idHints = ["id", "name", "title", "label", "key"];
  const idKey = keys.find(
    (k) =>
      idHints.some((h) => k.toLowerCase().includes(h)) &&
      typeof rows[0][k] === "string"
  );
  if (idKey) return idKey;

  // Fall back to first string column
  const strKey = keys.find((k) => typeof rows[0][k] === "string");
  if (strKey) return strKey;

  // Absolute fallback: first column
  return keys[0];
}

function formatLabel(value: any): string {
  if (value == null) return "";
  if (typeof value === "string" && !isNaN(Date.parse(value)) && value.includes("T")) {
    return new Date(value).toLocaleDateString();
  }
  return String(value);
}

function prettifyKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const COLORS = [
  "#4e79a7",
  "#f28e2b",
  "#e15759",
  "#76b7b2",
  "#59a14f",
  "#edc948",
  "#b07aa1",
  "#ff9da7",
  "#9c755f",
  "#bab0ac",
];
