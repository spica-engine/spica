/**
 * Shared log-level constants for function log views.
 * Single source of truth — import from here instead of defining locally.
 */

export type SeverityFilter = "all" | "log" | "info" | "warning" | "error" | "debug";

export type ActiveSeverity = Exclude<SeverityFilter, "all">;

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
  {key: "log", label: "Log", dotLabel: "L"},
  {key: "info", label: "Info", dotLabel: "I"},
  {key: "warning", label: "Warning", dotLabel: "W"},
  {key: "error", label: "Error", dotLabel: "E"},
  {key: "debug", label: "Debug", dotLabel: "D"},
];

// console.log (level 1) and console.info (level 2) are distinct severities so the
// filter can target one without pulling in the other.
export const SEVERITY_LEVEL_MAP: Record<ActiveSeverity, number[]> = {
  log: [1],
  info: [2],
  warning: [3],
  error: [4],
  debug: [0],
};

// Union of the concrete numeric levels for the currently selected severities.
// Empty selection means "all", so it returns undefined (no level filter applied).
export function getLevelsForSeverities(severities: ActiveSeverity[]): number[] | undefined {
  if (severities.length === 0) {
    return undefined;
  }

  const levels = new Set<number>();
  severities.forEach(severity => {
    SEVERITY_LEVEL_MAP[severity].forEach(level => levels.add(level));
  });

  return Array.from(levels).sort((a, b) => a - b);
}

export function getSeverityFilter(level: number): ActiveSeverity {
  if (level === 4) {
    return "error";
  }
  if (level === 3) {
    return "warning";
  }
  if (level === 0) {
    return "debug";
  }
  if (level === 1) {
    return "log";
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
  if (severity === "log") {
    return "L";
  }
  return "I";
}
