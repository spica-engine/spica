import { Action, Command, CreateCommandParameters } from "@caporal/core";
import { ActionParameters } from "../interface";

async function get({args, logger}: ActionParameters) {
    const {kind, name} = args;
    logger.info("test");
}

export default function({createCommand}: CreateCommandParameters): Command {
  return createCommand("Get an object from the API.")
    .argument("[kind]", "Kind of the object")
    .argument("[name]", "Name of the object")
    .option("-n, --namespace", "Namespace of the object.")
    .action((get as unknown) as Action);
}
