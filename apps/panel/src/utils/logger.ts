type Logger = Readonly<{
  log: (...msg: any[]) => void;
  warn: (...msg: any[]) => void;
  error: (...msg: any[]) => void;
  debug: (...msg: any[]) => void;
  group: (...msg: any[]) => void;
  groupEnd: () => void;
  time: (label: string) => void;
  timeEnd: (label: string) => void;
}>;

function makeLogger(): Logger {
  if (process.env.NODE_ENV !== "development") {
    const noLogging = () => {};
    return {
      log: noLogging,
      warn: noLogging,
      error: noLogging,
      debug: noLogging,
      group: noLogging,
      groupEnd: noLogging,
      time: noLogging,
      timeEnd: noLogging
    };
  }

  return {
    log: (...msg: any[]) => {
      console.log("%c[INFO]%c", "color: green; font-weight: bold;", "color: inherit;", ...msg);
    },
    warn: (...msg: any[]) => {
      console.warn("%c[WARN]%c", "color: orange; font-weight: bold;", "color: inherit;", ...msg);
    },
    error: (...msg: any[]) => {
      console.error("%c[ERROR]%c", "color: red; font-weight: bold;", "color: inherit;", ...msg);
    },
    debug: (...msg: any[]) => {
      console.debug("%c[DEBUG]%c", "color: blue; font-weight: bold;", "color: inherit;", ...msg);
    },
    group: (...msg: any[]) => {
      console.group("%c[GROUP]%c", "color: purple; font-weight: bold;", "color: inherit;", ...msg);
    },
    groupEnd: () => {
      console.groupEnd();
    },
    time: (label: string) => {
      console.time(label);
    },
    timeEnd: (label: string) => {
      console.timeEnd(label);
    }
  };
}

const logger = makeLogger();

export default logger;
