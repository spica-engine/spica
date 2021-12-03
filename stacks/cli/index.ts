import {program} from "@caporal/core";
import * as fs from "fs";
import * as path from "path";
import "./src/console";

// See: https://github.com/mattallty/Caporal.js/issues/197
function cleanUpDts(dir: string) {
  for (const item of fs.readdirSync(dir)) {
    if (fs.statSync(path.join(dir, item)).isDirectory()) {
      cleanUpDts(path.join(dir, item));
    } else {
      if (item.endsWith(".d.ts")) {
        fs.unlinkSync(path.join(dir, item));
      }
    }
  }
}

export function run(argv?: string[]) {
  const commandPath = path.join(__dirname, "src", "commands");

  cleanUpDts(commandPath);

  program
    .version("0.0.0-PLACEHOLDER")
    .name("spica")
    .bin("spica")
    .description("Command line interface for spica.")
    .discover(commandPath);

  return program.run(argv);
}
