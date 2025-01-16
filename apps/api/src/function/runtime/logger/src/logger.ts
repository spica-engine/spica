import {
  LogChannels,
  LogLevels,
  RESERVED_ENDING_INDICATOR,
  RESERVED_LOG_LEVEL_INDICATOR,
  RESERVED_LOG_REGEX,
  RESERVED_STARTING_INDICATOR
} from "./interface";

export function getLoggerConsole() {
  const copiedConsole = Object.assign({}, console);
  for (const logLevelName of Object.keys(LogLevels)) {
    const method = logLevelName.toLowerCase();

    const callback = copiedConsole[method];

    copiedConsole[method] = (...params) => {
      params = reserveLog(params, LogLevels[logLevelName]);
      return callback.bind(copiedConsole)(...params);
    };
  }
  return copiedConsole;
}

export function getOriginalConsole() {
  return Object.assign({}, console);
}

export function getLogs(message: string, channel: LogChannels) {
  const defaultLevel = channel == LogChannels.ERROR ? LogLevels.ERROR : LogLevels.LOG;

  const pairs: {level: number; message: string}[] = [];

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

    pairs.push({
      level: Number(m[1]),
      message: m[2].trim()
    });
  }

  const restOfMessage = message.replace(RESERVED_LOG_REGEX, "").trim();

  if (restOfMessage) {
    pairs.push({level: defaultLevel, message: restOfMessage});
  }

  return pairs;
}

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
