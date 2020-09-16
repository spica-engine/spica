import { blue, bold, green, red, yellow } from "colorette";
import * as columnify from "columnify";
import * as ora from "ora";
import * as util from "util";

let logger: Logger;

export function getLogger() {
  if (!logger) {
    logger = new Logger(process.stdout, process.stderr);
  }
  return logger;
}

export class Logger extends console.Console {
  spin(options?: ora.Options): ora.Ora;
  spin<T = any>(options?: ora.Options & {op: Promise<T>}): Promise<T>;
  spin<T = any>(options?: ora.Options & {op: (spinner: ora.Ora) => Promise<T>}): Promise<T>;
  spin(options?: ora.Options & {op?: Promise<unknown> | ((spinner: ora.Ora) => Promise<unknown>)}) {
    const spinner = ora({...options, color: options.color || "yellow"});
    if (typeof options.op == "function") {
      options.op = options.op(spinner);
    }
    if (options.op instanceof Promise) {
      spinner.start();
      return options.op.then(
        result => {
          spinner.succeed();
          return result;
        },
        error => {
          spinner.fail();
          if (typeof error == "object" && "message" in error) {
            this.error(error.message);
            process.exit();
          }
          return Promise.reject(error);
        }
      );
    }
    return spinner.start();
  }

  error(message?: any, ...optionalParams: any[]) {
    super.error(bold(red(util.format(message, ...optionalParams))));
  }

  warn(message?: any, ...optionalParams: any[]) {
    super.warn(bold(yellow(util.format(message, ...optionalParams))));
  }

  info(message?: any, ...optionalParams: any[]) {
    super.info(bold(blue(util.format(message, ...optionalParams))));
  }

  success(message?: any, ...optionalParams: any[]) {
    super.log(bold(green(util.format(message, ...optionalParams))));
  }

  table(tabularData: any, columns?: string[]) {
    if (!columns) {
      super.log(columnify(tabularData, {columnSplitter: "       "}));
    } else {
      super.log(columnify(tabularData, {columns, columnSplitter: "       "}));
    }
  }

  disableColors() {
    process.env.NO_COLOR="1";
  }
}
