import * as stackTrace from "error-stack-parser";
import * as fs from "fs";
import * as path from "path";
import * as util from "util";
import * as winston from "winston";
import * as DailyRotateFile from "winston-daily-rotate-file";
import {Execution} from "./interface";

export interface Logger {
  debug(message?: any, ...optionalParams: any[]);
  info(message?: any, ...optionalParams: any[]);
  log(message?: any, ...optionalParams: any[]);
  error(message?: any, ...optionalParams: any[]);
  warn(message?: any, ...optionalParams: any[]);
  [key: string]: (...args) => void;
}

interface QueryOptions {
  rows?: number;
  limit?: number;
  start?: number;
  from?: Date;
  until?: Date;
  order?: "asc" | "desc";
  fields: any;
}

export abstract class LoggerHost {
  abstract create(execution: Execution): {logger: Logger; dispose: Function};
  abstract create(
    execution: Execution,
    stream?: NodeJS.WritableStream
  ): {logger: Logger; dispose: Function};
  abstract create(
    execution: Execution,
    stream?: NodeJS.WritableStream
  ): {logger: Logger; dispose: Function};
  abstract query(targetId: string, options: QueryOptions): Promise<any>;
  abstract clear(targetId: string): Promise<void> | void;
}

export class WinstonLogger implements LoggerHost {
  constructor(private root: string) {}

  query(targetId: string, options: QueryOptions): Promise<any> {
    return new Promise((resolve, reject) => {
      const logger = this.getLogger(targetId);
      logger.query(options, (err, results) => {
        if (err) {
          return reject(err);
        }
        resolve(results.dailyRotateFile);
      });
    });
  }

  getLogger(targetId: string, executionId?: string, stream?: NodeJS.WritableStream) {
    const stackTraceFormat = winston.format(info => {
      if (info instanceof Error || (info.message != undefined && info.stack)) {
        const stack = stackTrace
          .parse((info as unknown) as Error)
          .map(({source, ..._}) => ({..._}));
        info = {
          level: info.level,
          message: info.message,
          stack,
          [Symbol.for("level")]: info.level
        };
      }
      return info;
    });

    const executionIdFormat = winston.format(info => {
      info.execution = executionId;
      return info;
    });

    const transport = stream
      ? new winston.transports.Stream({stream, close: () => stream.end()})
      : new DailyRotateFile({
          dirname: path.join(this.root, "logs"),
          filename: `${targetId}-%DATE%.log`,
          datePattern: "YYYY-MM-DD",
          zippedArchive: true,
          maxSize: "20m",
          maxFiles: "10d",
          json: true
        });

    return winston.createLogger({
      level: "silly",
      format: winston.format.combine(
        stackTraceFormat(),
        executionIdFormat(),
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [transport]
    });
  }

  create(execution: Execution, stream?: fs.WriteStream) {
    const logger = this.getLogger(execution.target.id, execution.id, stream);
    return {
      logger: {
        log: (message, ...optionalParams) => logger.silly(util.format(message, ...optionalParams)),
        debug: (message, ...optionalParams) =>
          logger.debug(util.format(message, ...optionalParams)),
        error: (message, ...optionalParams) =>
          logger.error(util.format(message, ...optionalParams)),
        info: (message, ...optionalParams) => logger.info(util.format(message, ...optionalParams)),
        warn: (message, ...optionalParams) => logger.warn(util.format(message, ...optionalParams)),
        dir: (object: any, options: util.InspectOptions) =>
          logger.silly(util.inspect(object, options)),
        time: (label: string) => logger.profile(label),
        timeEnd: (label: string) => logger.profile(label),
        clear: () => this.clear(execution.target.id)
      },
      dispose: () => logger.close()
    };
  }

  async clear(targetId: string): Promise<void> {
    const root = path.join(this.root, "logs");
    const files = await fs.promises.readdir(root);
    for (const file of files) {
      if (file.match(new RegExp(`${targetId}-.*?\.log.gz`))) {
        await fs.promises.unlink(path.join(root, file));
      } else if (file.match(new RegExp(`${targetId}-.*?\.log`))) {
        // We need clean up files instead deleting them
        // explicitly brokes the logging
        await fs.promises.writeFile(path.join(root, file), "").catch();
      }
    }
  }
}
