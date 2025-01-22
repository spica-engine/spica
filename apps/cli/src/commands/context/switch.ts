import {ActionParameters, Command, CreateCommandParameters, Program} from "@caporal/core";
import {context} from "../../context";
import {config} from "../../config";

async function switchContext({args}: ActionParameters) {
  const name = args.name as string;

  if (!context.has(name)) {
    console.error(`Could not found the context "${name}". You can add it by running; `);
    console.log("");
    console.log(`$ spica context add --name=${name} --url=URL_HERE --apikey=APIKEY_HERE`);
    return;
  }

  await config.set({
    context: name
  });

  console.info(`Context has been changed to "${name}".`);
}

export default function (program: Program): Command {
  return program
    .command("context switch", "Switch context")
    .argument("<name>", "Name of the context.")
    .action(switchContext);
}
