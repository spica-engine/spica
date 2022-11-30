import {Action, ActionParameters, Command, CreateCommandParameters} from "@caporal/core";
import {httpService} from "../../http";
import {RepresentativeManager} from "../../representative";
import * as path from "path";
import * as fs from "fs";
import * as YAML from "yaml";

async function apply({options}: ActionParameters) {
  const cwd = process.cwd();
  const repManager = new RepresentativeManager(cwd);
  const moduleAndFiles = new Map<string, string[]>();

  moduleAndFiles.set("bucket", ["schema.yaml"]);
  moduleAndFiles.set("function", ["schema.yaml", "package.json", "env.env", "index.ts"]);
  moduleAndFiles.set("preference", ["schema.yaml"]);

  const resourceNameValidator = _ => true;

  const resources = [];

  for (let [_module, fileNames] of moduleAndFiles.entries()) {
    let resource = await repManager.read(_module, resourceNameValidator, fileNames);
    resource = resource.map(r => {
      r.module = _module;
      return r;
    });
    resources.push(...resource);
  }

  const filename = path.relative(process.cwd(), "asset.yaml");
  const rawDocument = fs.readFileSync(filename).toString();
  const assetMeta = YAML.parseDocument(rawDocument);

  const body = {
    ...assetMeta.toJSON(),
    resources
  };

  const machineryClient = await httpService.createFromCurrentCtx();

  await machineryClient.post("/asset", body);

  return console.info("Uploaded Successfully");
}

export default function({createCommand}: CreateCommandParameters): Command {
  return createCommand("Put objects to the API.").action((apply as unknown) as Action);
}
