import {Action, ActionParameters, Command, CreateCommandParameters} from "@caporal/core";
import {httpService} from "../../http";
import {RepresentativeManager} from "../../representative";
import * as path from "path";
import * as fs from "fs";
import * as YAML from "yaml";

async function _delete({options}: ActionParameters) {
  const filename = path.relative(process.cwd(), "asset.yaml");
  const rawDocument = fs.readFileSync(filename).toString();
  const assetMeta = YAML.parseDocument(rawDocument).toJSON();

  const machineryClient = await httpService.createFromCurrentCtx();

  const asset = await machineryClient
    .get("/asset", {
      params: {
        name: assetMeta.name
      }
    })
    .then(r => r[0]);

  if (!asset) {
    console.error(`Asset named ${assetMeta.name} does not exist`);
  }

  await machineryClient.delete(`/asset/${asset._id}`);

  return console.info("Deleted Successfully");
}

export default function({createCommand}: CreateCommandParameters): Command {
  return createCommand("Delete objects of the API.").action((_delete as unknown) as Action);
}
