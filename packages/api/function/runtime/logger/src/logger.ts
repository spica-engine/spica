import {AsyncLocalStorage} from "async_hooks";
import {Console} from "console";
import {Writable} from "stream";
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

// Everything console can print that is not a log level of its own. Node binds the
// global console's methods to its internal console instance, so these never reach a
// wrapper assigned onto a copy — console.timeEnd's internal `this.log` is the original
// one, and its output would leave the worker unframed (and get dropped by the
// concurrent worker's log demultiplexer).
const CAPTURED_CONSOLE_METHODS = [
  "assert",
  "count",
  "countReset",
  "dir",
  "dirxml",
  "group",
  "groupCollapsed",
  "groupEnd",
  "table",
  "time",
  "timeEnd",
  "timeLog",
  "trace"
];

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

  // A private console whose streams feed back into the framed log/error above, so the
  // methods below keep their own state (timers, counters, group indent) while their
  // output is framed and correlated exactly like a console.log call.
  const capturingConsole = new Console({
    stdout: captureInto(message => copiedConsole.log(message)),
    stderr: captureInto(message => copiedConsole.error(message)),
    colorMode: false
  });

  for (const method of CAPTURED_CONSOLE_METHODS) {
    if (typeof capturingConsole[method] != "function") {
      continue;
    }
    copiedConsole[method] = (...params) => capturingConsole[method](...params);
  }

  return copiedConsole;
}

function captureInto(emit: (message: string) => void) {
  return new Writable({
    write(chunk, _encoding, callback) {
      const message = chunk.toString().replace(/\n$/, "");
      if (message) {
        emit(message);
      }
      callback();
    }
  });
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
