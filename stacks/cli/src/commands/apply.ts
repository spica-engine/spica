import { Action, CaporalValidator, Command, CreateCommandParameters } from "@caporal/core";
import { ActionParameters } from "../interface";
import * as YAML from "yaml";
import * as fs from "fs";
import { request } from "../request";
import { ResourceDefinition } from "./api-resources";

async function apply({args, logger, options}: ActionParameters) {
    const documents = YAML.parseAllDocuments(fs.readFileSync(options.filename as string).toString());

    for (const document of documents) {
        const {apiVersion, kind, metadata, spec} = document.toJSON();
        const resources = await request.get<ResourceDefinition[]>("http://localhost:4300/apis");
        let definition: ResourceDefinition;
        for (const resource of resources) {
          if ( resource.names.kind == kind) {
            definition = resource;
          }
        }
        
        if ( !definition ) {
          return logger.error(`the server doesn't have a resource type "${kind}"`);
        } 
      
        const version = definition.versions.find(version => version.current);
        
        const r = await request.post(`http://localhost:4300/apis/${definition.group}/${version.name}/${definition.names.plural}`, {metadata, spec});
        console.log(r);
        logger.info(`${definition.group}/${definition.names.singular} "${metadata.name}" replaced.`);
    }
}

export default function({createCommand}: CreateCommandParameters): Command {
  return createCommand("Get an object from the API.")
    .option("-f, --filename", "that contains the configuration to apply", {
        required: true,
        validator: CaporalValidator.STRING
    })
    .action((apply as unknown) as Action);
}
