import { Action, CaporalValidator, Command, CreateCommandParameters } from "@caporal/core";
import { ActionParameters } from "../interface";
import * as YAML from "yaml";
import * as fs from "fs";

async function get({args, logger, options}: ActionParameters) {
    const manifests = YAML.parseAllDocuments(fs.readFileSync(options.filename as string).toString());

    for (const manifest of manifests) {
        const apiVersion = manifest.get('apiVersion');
        const kind = manifest.get('kind');
        console.log(apiVersion, kind);
    }
}

export default function({createCommand}: CreateCommandParameters): Command {
  return createCommand("Get an object from the API.")
    .option("-f, --filename", "that contains the configuration to apply", {
        required: true,
        validator: CaporalValidator.STRING
    })
    .action((get as unknown) as Action);
}
