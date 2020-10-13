import { Action, Command, CreateCommandParameters } from "@caporal/core";
import { ActionParameters } from "../interface";
import { request } from "../request";
import { ResourceDefinition, ResourceDefinitionVersion, Resource } from "./api-resources";
import * as jsonpath from "jsonpath";
import * as duration from "pretty-ms";
import { stat } from "fs";

async function get({args, logger}: ActionParameters) {

  const groupList = await request.get<any>("http://localhost:4300/apis");

  const kind = args.kind as string;

  let resource: any;
  let groupVersion: any;

  for (const _group of groupList.groups) {
    const preferredVersion = _group.versions[0];
    const resourceList = await request.get<any>(`http://localhost:4300/apis/${_group.name}/${preferredVersion}`);
    for (const _resource of resourceList.resources) {
      if ( _resource.singular == kind || _resource.plural == kind || _resource.shortNames.indexOf(kind) != -1 ) {
        resource = _resource;
        groupVersion = `${_group.name}/${preferredVersion}`;
      }
    }
  }

  if ( !groupVersion || !resource ) {
    return;
  }
  

  const objects = await request.get<Resource[]>(`http://localhost:4300/apis/${groupVersion}/${resource.plural}`);

  const results = [];
  const columns = ['NAME', 'AGE', 'STATUS'];


  // for (const column of version.additionalPrinterColumns) {
  //   columns.push(column.name.toLocaleUpperCase());
  // }


  for (const object of objects) {
    const {spec, metadata, status} = object;

    const result: any = {
      NAME: metadata.name,
      AGE: duration( Date.now() - new Date(metadata.creationTimestamp).getTime(), {compact: true}),
      STATUS: status
    }

    // for (const column of version.additionalPrinterColumns) {
    //   const name =  column.name.toLocaleUpperCase();
    //   result[name] = jsonpath.query(object, `$${column.jsonPath}`);
    // }

    results.push(result);
  }

  
  logger.table(results, columns);
}

export default function({createCommand}: CreateCommandParameters): Command {
  return createCommand("Get an object from the API.")
    .argument("<kind>", "Kind of the object")
    .argument("[name]", "Name of the object")
    .option("-n, --namespace", "Namespace of the object.")
    .action((get as unknown) as Action);
}
