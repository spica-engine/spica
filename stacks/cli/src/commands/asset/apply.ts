import {Action, ActionParameters, Command, CreateCommandParameters} from "@caporal/core";
import {RepresentativeManager} from "../../representative";

async function apply({options}: ActionParameters) {
  const cwd = process.cwd();
  const repManager = new RepresentativeManager(cwd);
  const moduleAndFiles = new Map<string, string[]>();

  moduleAndFiles.set("bucket", ["schema.yaml"]);
  // moduleAndFiles.set("function", ["schema.yaml", "package.json", "env.env", "index.ts"]);
  moduleAndFiles.set("preference", ["schema.yaml"]);

  const resourceNameValidator = _ => true;

  const files = [];

  for (let [module, fileNames] of moduleAndFiles.entries()) {
    const file = await repManager.read(module, resourceNameValidator, fileNames);
    files.push(file);
  }

  console.dir(files,{depth:Infinity});
}

export default function({createCommand}: CreateCommandParameters): Command {
  return createCommand("Put objects to the API.").action((apply as unknown) as Action);
}
