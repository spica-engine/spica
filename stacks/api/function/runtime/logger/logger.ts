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

const originalConsoleMethods: {method: string; callback: (...args) => any}[] = [];

export function registerLogger() {
  for (const logLevelName of Object.keys(LogLevels)) {
    const method = logLevelName.toLowerCase();

    const callback = console[method];
    originalConsoleMethods.push({method, callback});

    console[method] = (...params) => {
      params = reserveLog(params, LogLevels[logLevelName]);
      return callback.bind(console)(...params);
    };
  }
}

export function unregisterLogger() {
  for (const methodWithCb of originalConsoleMethods) {
    console[methodWithCb.method] = methodWithCb.callback;
  }
}

export function getLogs(message: string, channel: LogChannels) {
  let defaultLevel = channel == LogChannels.ERROR ? LogLevels.ERROR : LogLevels.LOG;

  const matcheds: {level: number; message: string}[] = [];

  let m;
  while ((m = RESERVED_LOG_REGEX.exec(message)) !== null) {
    // This is necessary to avoid infinite loops with zero-width matches
    if (m.index === RESERVED_LOG_REGEX.lastIndex) {
      RESERVED_LOG_REGEX.lastIndex++;
    }

    // m[0] => matched string as whole
    // m[1] => first matched group from matched string(log level)
    // m[2] => second matched group from matched string(log message)
    if (!m[1] || !m[2]) {
      continue;
    }

    matcheds.push({
      level: Number(m[1]),
      message: m[2].trim()
    });
  }

  const restOfMessage = message.replace(RESERVED_LOG_REGEX, "").trim();

  if (restOfMessage) {
    matcheds.push({level: defaultLevel, message: restOfMessage});
  }

  return matcheds;
}

const RESERVED_STARTING_INDICATOR = "---SPICA_LOG_START";
const RESERVED_LOG_LEVEL_INDICATOR = "-SPICA_LOG_LEVEL:";
const RESERVED_ENDING_INDICATOR = "SPICA_LOG_END---";

const RESERVED_LOG_REGEX = new RegExp(
  `${RESERVED_STARTING_INDICATOR}\\n${RESERVED_LOG_LEVEL_INDICATOR}(\\d)\\n+(.*?)\\n${RESERVED_ENDING_INDICATOR}`,
  "gms"
);
function reserveLog(args: any[], level: LogLevels) {
  args = [
    `${RESERVED_STARTING_INDICATOR}\n${RESERVED_LOG_LEVEL_INDICATOR}${level}\n`,
    ...args,
    `\n${RESERVED_ENDING_INDICATOR}`
  ];
  return args;
}

export function generateLog(message: string, level: LogLevels) {
  const args = reserveLog([message], level);
  return args.join(" ");
}
