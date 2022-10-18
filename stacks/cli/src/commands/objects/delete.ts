import {ActionParameters, CaporalValidator, Command, CreateCommandParameters} from "@caporal/core";
import * as fs from "fs";
import * as path from "path";
import * as YAML from "yaml";
import {httpService} from "../../http";
import {formatFailureStatus, isFailureStatus} from "../../status";

async function _delete({options}: ActionParameters) {
  const machineryClient = await httpService.createFromCurrentCtx();

  const filename = path.normalize(options.filename as string);
  const documents = YAML.parseAllDocuments(fs.readFileSync(filename).toString());

  const ignoreNotFound = options.ignoreNotFound;

  for (const document of documents) {
    const {apiVersion, kind, metadata} = document.toJSON();

    const resourceList = await machineryClient.get<any>(`/apis-info/${apiVersion}`);

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

    const result = await machineryClient.delete(
      `/apis/${apiVersion}/${resource.plural}/${metadata.name}`
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
    .option("-f, --filename", "that contains the configuration to delete", {
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
    .action(_delete);
}
