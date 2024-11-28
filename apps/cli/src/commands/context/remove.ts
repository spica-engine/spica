import {ActionParameters, Command, CreateCommandParameters} from "@caporal/core";

import {context} from "../../context";

async function removeContext({args}: ActionParameters) {
  const name = args.name as string;
  if (!context.has(name)) {
    return console.error(`Context "${name}" does not exist.`);
  }

  context.remove(name);
  console.info(`Context "${name}" has been deleted.`);
}

export default function({createCommand}: CreateCommandParameters): Command {
  return createCommand("Remove context")
    .argument("<name>", "Name of the context.")
    .action(removeContext);
}
