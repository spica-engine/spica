import {ActionParameters, Command, CreateCommandParameters, Program} from "@caporal/core";

import {context} from "../../context";

async function removeContext({args}: ActionParameters) {
  const name = args.name as string;
  if (!context.has(name)) {
    return console.error(`Context "${name}" does not exist.`);
  }

  context.remove(name);
  console.info(`Context "${name}" has been deleted.`);
}

export default function (program: Program): Command {
  return program
    .command("context remove", "Remove context")
    .argument("<name>", "Name of the context.")
    .action(removeContext);
}
