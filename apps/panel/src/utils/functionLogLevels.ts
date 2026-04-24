/**
 * Shared log-level constants for function log views.
 * Single source of truth — import from here instead of defining locally.
 */

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
