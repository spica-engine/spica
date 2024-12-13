import {Action, ActionParameters, Command, CreateCommandParameters, Program} from "@caporal/core";
import {httpService} from "../../http";
import * as fs from "fs";
import * as YAML from "yaml";

async function _delete({options}: ActionParameters) {
  const type = options.type as string;
  const folderPath = (options.path as string) || process.cwd();
  const rawDocument = fs.readFileSync(folderPath).toString();
  const assetMeta = YAML.parseDocument(rawDocument).toJSON();

  const client = await httpService.createFromCurrentCtx();

  const asset = await client
    .get("/asset", {
      params: {
        name: assetMeta.name
      }
    })
    .then(r => r[0]);

  if (!asset) {
    console.error(`Asset ${assetMeta.name} does not exist`);
  }

  await client.delete(`/asset/${asset._id}`, {params: {type}});

  return console.info("Asset ${assetMeta.name} has been deleted successfully");
}

export default function(program: Program): Command {
  return program
    .command("asset delete", "Delete objects of the API.")
    .option(
      "--path <path>",
      "Path of the folder that container asset.yaml file and resources of it. Current working directory is the default value."
    )
    .option("--type <type>", "Deletion type. Available options are 'soft' and 'hard'", {
      required: true
    })
    .action((_delete as unknown) as Action);
}
