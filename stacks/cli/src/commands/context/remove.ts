import {ActionParameters, Command, CreateCommandParameters} from "@caporal/core";

import {context} from "../../context";
import {config} from "../../config";

async function removeContext({args}: ActionParameters) {
  const name = args.name as string;
  if (!context.has(name)) {
    return console.error(`Context "${name}" does not exist.`);
  }

  context.remove(name);
  console.info(`Context "${name}" has been deleted.`);

  const selected = await config.get();
  if (selected.context == name) {
    await config.set({context: undefined});
  }
}

export default function({createCommand}: CreateCommandParameters): Command {
  return createCommand("Remove context")
    .argument("<name>", "Name of the context.")
    .action(removeContext);
}
