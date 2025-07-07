type Logger = Readonly<{
  log: (msg: any) => void;
  warn: (msg: any) => void;
  error: (msg: any) => void;
  debug: (msg: any) => void;
  group: (msg: any) => void;
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
    log: (msg: any) => {
      console.log(`%c[INFO]%c ${msg}`, "color: green; font-weight: bold;", "color: inherit;");
    },
    warn: (msg: any) => {
      console.warn(`%c[WARN]%c ${msg}`, "color: orange; font-weight: bold;", "color: inherit;");
    },
    error: (msg: any) => {
      console.error(`%c[ERROR]%c ${msg}`, "color: red; font-weight: bold;", "color: inherit;");
    },
    debug: (msg: any) => {
      console.debug(`%c[DEBUG]%c ${msg}`, "color: blue; font-weight: bold;", "color: inherit;");
    },
    group: (msg: any) => {
      console.group(`%c[GROUP]%c ${msg}`, "color: purple; font-weight: bold;", "color: inherit;");
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
