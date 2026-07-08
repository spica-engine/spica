import {AsyncLocalStorage} from "async_hooks";
import {
  RESERVED_ENDING_INDICATOR,
  RESERVED_EVENT_INDICATOR,
  RESERVED_LOG_LEVEL_INDICATOR,
  RESERVED_LOG_REGEX,
  RESERVED_STARTING_INDICATOR
} from "./consts.js";
import {LogChannels, LogLevels} from "@spica-server/interface-function-runtime";

// Correlates each console call with the event being processed, surviving across
// await points so concurrent in-process invocations can be demultiplexed by the
// parent. Empty store (single-concurrency) → frames omit the event id.
export const logContext = new AsyncLocalStorage<{eventId?: string}>();

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

  const pairs: {level: number; eventId?: string; message: string}[] = [];

  let m;
  while ((m = RESERVED_LOG_REGEX.exec(message)) !== null) {
    // This is necessary to avoid infinite loops with zero-width matches
    if (m.index === RESERVED_LOG_REGEX.lastIndex) {
      RESERVED_LOG_REGEX.lastIndex++;
    }

    // m[0] => whole match
    // m[1] => log level
    // m[2] => event id (optional, may be undefined)
    // m[3] => log message
    if (!m[1] || m[3] == null) {
      continue;
    }

    pairs.push({
      level: Number(m[1]),
      eventId: m[2] ? m[2].trim() : undefined,
      message: m[3].trim()
    });
  }

  const restOfMessage = message.replace(RESERVED_LOG_REGEX, "").trim();

  if (restOfMessage) {
    pairs.push({level: defaultLevel, message: restOfMessage});
  }

  return pairs;
}

function reserveLog(args: any[], level: LogLevels) {
  const eventId = logContext.getStore()?.eventId;
  const eventLine = eventId ? `${RESERVED_EVENT_INDICATOR}${eventId}\n` : "";
  args = [
    `${RESERVED_STARTING_INDICATOR}\n${RESERVED_LOG_LEVEL_INDICATOR}${level}\n${eventLine}`,
    ...args,
    `\n${RESERVED_ENDING_INDICATOR}`
  ];
  return args;
}

export function generateLog(message: string, level: LogLevels) {
  const args = reserveLog([message], level);
  return args.join(" ");
}
