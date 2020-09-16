import {Program} from "@caporal/core";
import {Logger} from "./logger";
import * as path from "path";
import * as fs from "fs";

function cleanUpDts(dir: string) {
  for (const item of fs.readdirSync(dir)) {
    if ( fs.statSync(path.join(dir, item)).isDirectory() ) {
      cleanUpDts(path.join(dir, item));
    } else {
      if ( item.endsWith(".d.ts") ) {
        fs.unlinkSync(path.join(dir, item));
      }
    }
  }
}

cleanUpDts(path.join(__dirname, "commands"));

new Program()
  .version("0.0.0-PLACEHOLDER")
  .name("spica")
  .description("Command line interface for spica.")
  .logger(new Logger(process.stdout, process.stderr) as any)
  .discover(path.join(__dirname, "commands"))
  .run();
