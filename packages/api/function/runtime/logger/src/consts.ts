export const RESERVED_STARTING_INDICATOR = "---SPICA_LOG_START";
export const RESERVED_LOG_LEVEL_INDICATOR = "-SPICA_LOG_LEVEL:";
export const RESERVED_EVENT_INDICATOR = "-SPICA_LOG_EVENT:";
export const RESERVED_ENDING_INDICATOR = "SPICA_LOG_END---";

// The event line is optional so frames produced without a correlation id
// (generateLog, single-concurrency workers) still parse as before.
export const RESERVED_LOG_REGEX = new RegExp(
  `${RESERVED_STARTING_INDICATOR}\\n${RESERVED_LOG_LEVEL_INDICATOR}(\\d)\\n(?:${RESERVED_EVENT_INDICATOR}(.*?)\\n)?(.*?)\\n${RESERVED_ENDING_INDICATOR}`,
  "gms"
);
