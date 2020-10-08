import { Action, Command, CreateCommandParameters } from "@caporal/core";
import { ActionParameters } from "../interface";
import { request } from "../request";
import { ResourceDefinition, ResourceDefinitionVersion, Resource } from "./api-resources";
import * as jsonpath from "jsonpath";
import * as duration from "pretty-ms";

async function get({args, logger}: ActionParameters) {
  const resources = await request.get<ResourceDefinition[]>("http://localhost:4300/apis");
  const kind = args.kind as string;
  let definition: ResourceDefinition;
  for (const resource of resources) {
    if ( resource.names.shortnames.indexOf(kind) != -1 || resource.names.singular == kind || resource.names.plural == kind) {
      definition = resource;
    }
  }
  
  if ( !definition ) {
    return logger.error(`the server doesn't have a resource type "${kind}"`);
  } 

  const version = definition.versions.find(version => version.current);
  
  const objects = await request.get<Resource[]>(`http://localhost:4300/apis/${definition.group}/${version.name}/${definition.names.plural}`);

  const results = [];
  const columns = ['NAME', 'AGE'];


  for (const column of version.additionalPrinterColumns) {
    columns.push(column.name.toLocaleUpperCase());
  }


  for (const object of objects) {
    const {spec, metadata} = object;

    const result: any = {
      NAME: metadata.name,
      AGE: duration( Date.now() - new Date(metadata.creationTimestamp).getTime(), {compact: true})
    }

    for (const column of version.additionalPrinterColumns) {
      const name =  column.name.toLocaleUpperCase();
      result[name] = jsonpath.query(object, `$${column.jsonPath}`);
    }

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
