import {Action, ActionParameters, Command, CreateCommandParameters, Program} from "@caporal/core";
import {httpService} from "../../http";
import {RepresentativeManager} from "../../representative";
import {Resource} from "../../../../../libs/interface/asset";
import path from "path";
import fs from "fs";
import YAML from "yaml";

async function apply({options}: ActionParameters) {
  const folderPath = (options.path as string) || process.cwd();

  const filename = path.join(folderPath, "asset.yaml");
  const rawDocument = fs.readFileSync(filename).toString();
  const assetMeta = YAML.parseDocument(rawDocument).toJSON();

  console.log("Found Asset:");
  console.log(` ${assetMeta.name}`);

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

  const resources: Resource[] = [];

  console.log("");
  console.log("Found Resources:");

  for (let [_module, fileNames] of moduleAndFiles.entries()) {
    let resource: Resource[] = await repManager.read(_module, resourceNameValidator, fileNames);
    console.log(` - ${_module}: ${resource.length}`);

    resource = resource.map(r => {
      r.module = _module;
      return r;
    });
    resources.push(...resource);
  }

  if (options.dryRun) return;

  const body = {
    ...assetMeta,
    resources
  };

  const client = await httpService.createFromCurrentCtx();

  await client.post("/asset", body);

  return console.info(`Asset ${body.name} has been uploaded successfully`);
}

export default function (program: Program): Command {
  return program
    .command("asset apply", "Put objects to the API.")
    .option(
      "--path <path>",
      "Path of the folder that container asset.yaml file and resources of it. Current working directory is the default value."
    )
    .option("--dry-run", "Shows the changes that will be applied to the target instance.")
    .action(apply as unknown as Action);
}
