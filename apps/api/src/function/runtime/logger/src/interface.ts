export enum LogLevels {
  DEBUG,
  LOG,
  INFO,
  WARN,
  ERROR
}

export enum LogChannels {
  OUT = "stdout",
  ERROR = "stderr"
}

export const RESERVED_STARTING_INDICATOR = "---SPICA_LOG_START";
export const RESERVED_LOG_LEVEL_INDICATOR = "-SPICA_LOG_LEVEL:";
export const RESERVED_ENDING_INDICATOR = "SPICA_LOG_END---";

export const RESERVED_LOG_REGEX = new RegExp(
  `${RESERVED_STARTING_INDICATOR}\\n${RESERVED_LOG_LEVEL_INDICATOR}(\\d)\\n+(.*?)\\n${RESERVED_ENDING_INDICATOR}`,
  "gms"
);
