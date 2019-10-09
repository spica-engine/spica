import {Collection, DatabaseService, ObjectId} from "@spica-server/database";
import * as os from "os";
import * as util from "util";
//import * as stackTrace from "error-stack-parser";
import {Execution} from "./interface";

export interface Logger {
  debug(message?: any, ...optionalParams: any[]);
  info(message?: any, ...optionalParams: any[]);
  log(message?: any, ...optionalParams: any[]);
  error(message?: any, ...optionalParams: any[]);
  warn(message?: any, ...optionalParams: any[]);
  _destroy(): void;
  [key: string]: (...args) => void;
}

interface QueryOptions {
  limit?: number;
  skip?: number;
  from?: Date;
  until?: Date;
  sort?: -1 | 1;
}

export abstract class LoggerHost {
  abstract create(execution: Execution, stream?: NodeJS.WritableStream): Logger | Promise<Logger>;
  abstract query(targetId: string, options: QueryOptions): Promise<any>;
  abstract clear(targetId: string): Promise<void> | void;
}

export class DatabaseLogger implements LoggerHost {
  constructor(private db: DatabaseService) {}

  async create(execution: Execution, stream?: NodeJS.WritableStream): Promise<Logger> {
    let collection: Collection;
    if (!stream) {
      collection = await this.db.createCollection(`function_${execution.target.id}`, {
        capped: true,
        size: 5242880,
        max: 1000
      });
    }

    const log = (level: string, messageOrError: string | Error, ...optionalParams: any[]) => {
      const message = {
        level,
        message:
          optionalParams.length >= 1
            ? util.format(messageOrError, ...optionalParams)
            : util.format(messageOrError),
        execution: execution.id
      };
      // TODO(thesayyn): Handle track traces
      // if (messageOrError instanceof Error || (messageOrError != undefined && messageOrError['stack'])) {
      //   const stack = stackTrace
      //     .parse((info as unknown) as Error)
      //     .map(({source, ..._}) => ({..._}));
      //   info = {
      //     level: info.level,
      //     message: info.message,
      //     stack,
      //     [Symbol.for("level")]: info.level
      //   };
      // }
      if (!stream) {
        collection.insertOne(message);
      } else {
        stream.write(`${JSON.stringify(message)}${os.EOL}`);
      }
    };
    return {
      debug: (message: string, ...optionalParams: any[]) =>
        log("debug", message, ...optionalParams),
      error: (message: string, ...optionalParams: any[]) =>
        log("error", message, ...optionalParams),
      log: (message: string, ...optionalParams: any[]) => log("log", message, ...optionalParams),
      info: (message: string, ...optionalParams: any[]) => log("info", message, ...optionalParams),
      warn: (message: string, ...optionalParams: any[]) => log("warn", message, ...optionalParams),
      clear: () => this.clear(execution.target.id),
      _destroy: () => stream && stream.end()
    };
  }

  query(targetId: string, options: QueryOptions): Promise<any> {
    let query: any;

    const toObjectId = (d: Date) => {
      return new ObjectId(`${Math.floor(d.getTime() / 1000).toString(16)}0000000000000000`);
    };

    if (options.from && options.until) {
      query = {_id: {$gt: toObjectId(options.from), $lte: toObjectId(options.until)}};
    }

    let cursor = this.db.collection(`function_${targetId}`).find(query);

    if (options.sort) {
      cursor = cursor.sort({$natural: options.sort});
    }

    if (options.limit) {
      cursor = cursor.limit(options.limit);
    }

    if (options.skip) {
      cursor = cursor.skip(options.skip);
    }

    return cursor.toArray();
  }

  clear(targetId: string): void | Promise<void> {
    return this.db
      .collection(`function_${targetId}`)
      .drop()
      .then();
  }
}
