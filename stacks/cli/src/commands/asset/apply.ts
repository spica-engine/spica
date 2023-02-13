import {Action, ActionParameters, Command, CreateCommandParameters} from "@caporal/core";
import {httpService} from "../../http";
import {RepresentativeManager} from "../../representative";
import {Resource} from "@spica-server/interface/asset";
import * as path from "path";
import * as fs from "fs";
import * as YAML from "yaml";

async function apply({options}: ActionParameters) {
  const folderPath = (options.path as string) || process.cwd();
  const repManager = new RepresentativeManager(folderPath);
  const moduleAndFiles = new Map<string, string[]>();

  moduleAndFiles.set("bucket", ["schema.yaml"]);
  moduleAndFiles.set("function", [
    "schema.yaml",
    "package.json",
    "env.env",
    "index.ts",
    "index.js"
  ]);
  moduleAndFiles.set("preference", ["schema.yaml"]);
  moduleAndFiles.set("dashboard", ["schema.yaml"]);
  moduleAndFiles.set("apikey", ["schema.yaml"]);

  const resourceNameValidator = id => id.match(/^([0-9a-fA-F]{24}$)|identity/);

  const resources = [];

  for (let [_module, fileNames] of moduleAndFiles.entries()) {
    let resource: Resource[] = await repManager.read(_module, resourceNameValidator, fileNames);
    resource = resource.map(r => {
      r.module = _module;
      return r;
    });
    resources.push(...resource);
  }

  const filename = path.relative(folderPath, "asset.yaml");
  const rawDocument = fs.readFileSync(filename).toString();
  const assetMeta = YAML.parseDocument(rawDocument);

  const body = {
    ...assetMeta.toJSON(),
    resources
  };

  const machineryClient = await httpService.createFromCurrentCtx();

  await machineryClient.post("/asset", body);

  return console.info(`Asset ${body.name} has been uploaded successfully`);
}

export default function({createCommand}: CreateCommandParameters): Command {
  return createCommand("Put objects to the API.")
    .option(
      "--path <path>",
      "Path of the folder that container asset.yaml file and resources of it. Current working directory is the default value."
    )
    .action((apply as unknown) as Action);
}
