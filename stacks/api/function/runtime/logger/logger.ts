export enum LogLevels {
  TRACE,
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
      params = putLogLevel(params, LogLevels[logLevelName]);
      return callback.bind(console)(...params);
    };
  }
}

export function unregisterLogger() {
  for (const methodWithCb of originalConsoleMethods) {
    console[methodWithCb.method] = methodWithCb.callback;
  }
}

export function seperateMessageAndLevel(message: string, channel: LogChannels) {
  let level = channel == LogChannels.ERROR ? LogLevels.ERROR : LogLevels.LOG;
  const defaultRes = {
    level,
    message
  };

  const logLevel = extractLogLevel(message);
  const matchedMethod = LogLevels[logLevel];

  if (!matchedMethod) {
    return defaultRes;
  }

  level = logLevel;
  message = removeLogLevel(message);

  return {
    level,
    message
  };
}

const LOG_LEVEL_REGEX = /.*\log_level:\ (\d+)/;

function putLogLevel(args: any[], level: LogLevels) {
  args.unshift(`log_level: ${level}`);
  return args;
}

function extractLogLevel(msg: string) {
  const mactheds = LOG_LEVEL_REGEX.exec(msg);

  return mactheds ? Number(mactheds[1]) : undefined;
}

function removeLogLevel(msg: string) {
  return msg.replace(LOG_LEVEL_REGEX, "");
}
