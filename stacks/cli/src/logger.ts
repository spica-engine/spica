import chalk from "chalk";
import * as columnify from "columnify";
import * as ora from "ora";
import * as util from "util";

export class Logger extends console.Console {
  spin(options?: ora.Options): ora.Ora;
  spin<T = any>(options?: ora.Options & {op: Promise<T>}): Promise<T>;
  spin<T = any>(options?: ora.Options & {op: (spinner: ora.Ora) => Promise<T>}): Promise<T>;
  spin(options?: ora.Options & {op?: Promise<any> | ((spinner: ora.Ora) => Promise<any>)}) {
    const spinner = ora(options);
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
          if ("message" in error) {
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
    super.warn(chalk.bold(chalk.red(util.format(message, ...optionalParams))));
  }

  warn(message?: any, ...optionalParams: any[]) {
    super.warn(chalk.bold(chalk.yellow(util.format(message, ...optionalParams))));
  }

  info(message?: any, ...optionalParams: any[]) {
    super.info(chalk.bold(chalk.blue(util.format(message, ...optionalParams))));
  }

  success(message?: any, ...optionalParams: any[]) {
    super.log(chalk.bold(chalk.green(util.format(message, ...optionalParams))));
  }

  table(tabularData: any, properties?: string[]) {
    if (!properties) {
      super.log(columnify(tabularData, {columnSplitter: "    "}));
    } else {
      super.log(columnify(tabularData, {columns: properties, columnSplitter: "    "}));
    }
  }
}
