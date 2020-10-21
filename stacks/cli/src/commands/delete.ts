import {ActionParameters, CaporalValidator, Command, CreateCommandParameters} from "@caporal/core";
import * as fs from "fs";
import * as path from "path";
import * as YAML from "yaml";
import {request} from "../request";
import {formatFailureStatus, isFailureStatus} from "../status";

async function del({options}: ActionParameters) {
  const filename = path.normalize(options.filename as string);
  const documents = YAML.parseAllDocuments(fs.readFileSync(filename).toString());

  const ignoreNotFound = options.ignoreNotFound;

  for (const document of documents) {
    const {apiVersion, kind, metadata, spec} = document.toJSON();

    const resourceList = await request.get<any>(`http://localhost:4300/apis/${apiVersion}`);

    if (isFailureStatus(resourceList)) {
      return console.error(formatFailureStatus(resourceList));
    }

    let resource;

    for (const _resource of resourceList.resources) {
      if (_resource.kind == kind) {
        resource = _resource;
      }
    }

    if (!resource) {
      return console.error(`the server doesn't have a resource type "${kind}"`);
    }

    const result = await request.del(
      `http://localhost:4300/apis/${apiVersion}/${resource.plural}/${metadata.name}`
    );
    if (isFailureStatus(result) && result.reason == "NotFound") {
      if (!ignoreNotFound) {
        return console.error(formatFailureStatus(result));
      }
    } else if (isFailureStatus(result)) {
      return console.error(formatFailureStatus(result));
    }

    console.info(`${resource.singular} "${metadata.name}" deleted.`);
  }
}

export default function({createCommand}: CreateCommandParameters): Command {
  return createCommand("Delete object(s) from the API.")
    .option("-f, --filename", "that contains the configuration to apply", {
      required: true,
      validator: CaporalValidator.STRING
    })
    .option(
      "--ignore-not-found",
      'Treat "resource not found" as a successful delete. Defaults to "true" when --all is specified.',
      {
        default: false
      }
    )
    .action(del);
}
