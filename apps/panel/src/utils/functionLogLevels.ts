/**
 * Shared log-level constants for function log views.
 * Single source of truth — import from here instead of defining locally.
 */

export type SeverityFilter = "all" | "info" | "warning" | "error" | "debug";

export const LOG_LEVEL_LABELS: Record<number, string> = {
  0: "Debug",
  1: "Log",
  2: "Info",
  3: "Warning",
  4: "Error",
};

export const LOG_LEVEL_OPTIONS = [
  {value: 0, label: "Debug"},
  {value: 1, label: "Log"},
  {value: 2, label: "Info"},
  {value: 3, label: "Warning"},
  {value: 4, label: "Error"},
];

export const SEVERITY_CHIPS: Array<{key: SeverityFilter; label: string; dotLabel?: string}> = [
  {key: "all", label: "All"},
  {key: "info", label: "Info", dotLabel: "I"},
  {key: "warning", label: "Warning", dotLabel: "W"},
  {key: "error", label: "Error", dotLabel: "E"},
  {key: "debug", label: "Debug", dotLabel: "D"},
];

export const SEVERITY_LEVEL_MAP: Record<Exclude<SeverityFilter, "all">, number[]> = {
  info: [1, 2],
  warning: [3],
  error: [4],
  debug: [0],
};

export function getSeverityFilter(level: number): SeverityFilter {
  if (level === 4) {
    return "error";
  }
  if (level === 3) {
    return "warning";
  }
  if (level === 0) {
    return "debug";
  }
  return "info";
}

export function getSeverityBadge(level: number) {
  const severity = getSeverityFilter(level);

  if (severity === "warning") {
    return "W";
  }
  if (severity === "error") {
    return "E";
  }
  if (severity === "debug") {
    return "D";
  }
  return "I";
}
