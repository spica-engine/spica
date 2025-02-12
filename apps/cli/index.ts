import caporalCore from "@caporal/core";
const {program} = caporalCore;

import "./src/console";
import assetApply from "./src/commands/asset/apply";
import assetDelete from "./src/commands/asset/delete";
import bucketOrm from "./src/commands/bucket/orm";
import contextLs from "./src/commands/context/ls";
import contextRemove from "./src/commands/context/remove";
import contextSet from "./src/commands/context/set";
import contextSwitch from "./src/commands/context/switch";
import functionOrm from "./src/commands/function/orm";
import projectLs from "./src/commands/project/ls";
import projectRemove from "./src/commands/project/remove";
import projectStart from "./src/commands/project/start";
import projectSync from "./src/commands/project/sync";
import projectUpgrade from "./src/commands/project/upgrade";

export function run(argv?: string[]) {
  program
    .version("0.0.0-PLACEHOLDER")
    .name("spica")
    .bin("spica")
    .description("Command line interface for spica.");

  assetApply(program);
  assetDelete(program);
  bucketOrm(program);
  contextLs(program);
  contextRemove(program);
  contextSet(program);
  contextSwitch(program);
  functionOrm(program);
  projectLs(program);
  projectRemove(program);
  projectStart(program);
  projectSync(program);
  projectUpgrade(program);

  return program.run(argv);
}
