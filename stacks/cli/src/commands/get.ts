import { Action, Command, CreateCommandParameters } from "@caporal/core";
import { ActionParameters } from "../interface";
import { request } from "../request";
import { ResourceDefinition, ResourceDefinitionVersion, ResourceSpec } from "./api-resources";

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
  
  const objects = await request.get<ResourceSpec[]>(`http://localhost:4300/apis/${definition.group}/${version.name}/${definition.names.plural}`);

  logger.table(objects.map(object => {
    const {spec, metadata} = object;
    return {
      NAME: metadata.name,
      AGE: '12d'
    }
  }), ['NAME', 'STATUS', 'AGE']);
}

export default function({createCommand}: CreateCommandParameters): Command {
  return createCommand("Get an object from the API.")
    .argument("<kind>", "Kind of the object")
    .argument("[name]", "Name of the object")
    .option("-n, --namespace", "Namespace of the object.")
    .action((get as unknown) as Action);
}
